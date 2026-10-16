const NOMEN = [
  {
    id: 'veh',
    title: 'Vehicle and motion',
    rows: [
      [`${I('x')}, ${I('y')}`, 'Position of the robot reference point in the world frame (rear-axle center for the car)', 'm'],
      ['θ', 'Heading (yaw), counter-clockwise from +x', 'rad'],
      [I('v'), 'Longitudinal speed, negative when reversing', 'm/s'],
      ['ω', 'Yaw rate, θ̇', 'rad/s'],
      [I('a'), 'Longitudinal acceleration', 'm/s²'],
      ['α', 'Angular acceleration (diff-drive)', 'rad/s²'],
      [`${I('v')}<sub>max</sub>, ω<sub>max</sub>`, 'Speed and yaw-rate limits', 'm/s, rad/s'],
      [`${I('a')}<sub>max</sub>, α<sub>max</sub>`, 'Acceleration limits', 'm/s², rad/s²'],
      ['τ', 'Time constant of the first-order actuator lag', 's'],
      [`Δ${I('t')}`, 'Time step: 0.05 s for the simulation, tunable for the MPC prediction', 's'],
      [I('L'), 'Wheelbase (written L<sub>wb</sub> where L could be confused)', 'm'],
      ['δ', 'Front-wheel steering angle', 'rad'],
      ['δ<sub>max</sub>', 'Steering-angle limit', 'rad'],
      ['δ̇', 'Steering rate', 'rad/s'],
      [`${I('R')}<sub>min</sub>`, `Minimum turning radius, ${I('L')} / tan δ<sub>max</sub>`, 'm'],
      ['κ', 'Path curvature, positive to the left', '1/m'],
      [I('r'), 'Robot radius (diff-drive, 0.3 m) or covering-circle radius (car)', 'm'],
      // the car with tyre slip (dynamic bicycle model, chapter 1 §4–5)
      [I('m'), 'Mass (car with tyre slip)', 'kg'],
      [`${I('I')}<sub>z</sub>`, 'Yaw moment of inertia about the centre of mass', 'kg·m²'],
      [
        `${I('l')}<sub>f</sub>, ${I('l')}<sub>r</sub>`,
        `Distance from the centre of mass to the front and rear axle, ${I('l')}<sub>f</sub> + ${I('l')}<sub>r</sub> = ${I('L')}`,
        'm'
      ],
      [
        `${I('C')}<sub>f</sub>, ${I('C')}<sub>r</sub>`,
        'Cornering stiffness of the front and rear axle: sideways force per radian of slip angle',
        'N/rad'
      ],
      ['μ', 'Tyre–floor friction coefficient; each axle pushes sideways with at most μ times its load', '–'],
      [
        `${I('F')}<sub>z</sub>`,
        `Static axle load, ${I('F')}<sub>zf</sub> = ${I('m g l')}<sub>r</sub>/${I('L')}, ${I('F')}<sub>zr</sub> = ${I('m g l')}<sub>f</sub>/${I('L')}`,
        'N'
      ],
      [`${I('v')}<sub>x</sub>, ${I('v')}<sub>y</sub>`, 'Forward and lateral velocity of the centre of mass in body axes', 'm/s'],
      [`${I('r')} (yaw rate)`, 'Yaw rate of the car with tyre slip, a state of its own (θ̇ = r)', 'rad/s'],
      ['α<sub>f</sub>, α<sub>r</sub>', 'Slip angles of the front and rear tyres: where the wheel points minus where it moves', 'rad'],
      ['β', `Sideslip angle at the centre of mass, atan(${I('v')}<sub>y</sub>/${I('v')}<sub>x</sub>)`, 'rad'],
      [`${I('a')}<sub>y</sub>`, 'Lateral acceleration; the grip limit is about μ<i>g</i>', 'm/s²'],
      [
        `${I('K')}<sub>us</sub>`,
        `Understeer gradient, (${I('m')}/${I('L')})(${I('l')}<sub>r</sub>/${I('C')}<sub>f</sub> − ${I('l')}<sub>f</sub>/${I('C')}<sub>r</sub>): extra steering per unit of lateral acceleration`,
        'rad/(m/s²)'
      ],
      [
        `${I('v')}<sub>ch</sub>`,
        `Characteristic speed √(${I('L')}/${I('K')}<sub>us</sub>): the yaw-rate gain peaks there at half of ${I('v')}/${I('L')}`,
        'm/s'
      ]
    ]
  },
  {
    id: 'loc',
    title: 'Localization',
    rows: [
      ['μ', `Pose estimate (mean), [${I('x̂')}, ${I('ŷ')}, θ̂]`, 'm, rad'],
      ['Σ', 'Pose-estimate covariance, 3 × 3', ''],
      [I('u'), `Odometry input, (${I('v')}, ω)`, 'm/s, rad/s'],
      [`${I('g')}(μ, ${I('u')})`, 'Discrete motion model', ''],
      [`${I('G')}, ${I('V')}`, `Jacobians of ${I('g')} with respect to the state and the input`, ''],
      [I('M'), 'Odometry noise covariance, diag(σ<sub>v</sub>², σ<sub>ω</sub>²)', ''],
      ['σ<sub>v</sub>, σ<sub>ω</sub>', 'Odometry noise standard deviations', 'm/s, rad/s'],
      [I('k'), 'Odometry noise scale (Localize slider); the filter assumes its own multiple of it', ''],
      [I('b'), 'Odometry calibration bias, not modeled by the filters', ''],
      [`${I('z')} = [${I('r')}, ${I('b')}]`, 'Beacon measurement: range and bearing', 'm, rad'],
      [I('ẑ'), 'Predicted measurement', 'm, rad'],
      [I('q'), 'Squared distance to the beacon, Δx² + Δy²', 'm²'],
      ['ν', `Innovation, ${I('z')} − ${I('ẑ')}`, 'm, rad'],
      [I('H'), `Measurement Jacobian, ∂${I('ẑ')}/∂μ`, ''],
      [I('Q'), 'Measurement noise covariance, diag(σ<sub>r</sub>², σ<sub>b</sub>²)', ''],
      [I('S'), `Innovation covariance, ${I('H')}Σ${I('H')}ᵀ + ${I('Q')}`, ''],
      [I('K'), `Kalman gain, Σ${I('H')}ᵀ${I('S')}⁻¹`, ''],
      [`${I('d')}²`, `Squared Mahalanobis distance, νᵀ${I('S')}⁻¹ν; readings with ${I('d')}² > 9.21 (χ²₂, 99 %) are rejected`, ''],
      [I('N'), 'Number of particles', ''],
      [`${I('w')}<sub>i</sub>`, `Normalized weight of particle ${I('i')}`, ''],
      [`${I('N')}<sub>eff</sub>`, `Effective sample size, 1 / Σ ${I('w')}<sub>i</sub>²; resample when below ${I('N')}/2`, ''],
      ['α<sub>fast</sub>, α<sub>slow</sub>', 'Smoothing rates of the short- and long-term likelihood averages (augmented MCL)', ''],
      [I('e'), 'Pose error, truth − estimate', 'm, rad'],
      ['NEES', `Normalized estimation error squared, ${I('e')}ᵀΣ⁻¹${I('e')}; about 3 when the filter is consistent`, '']
    ]
  },
  {
    id: 'per',
    title: 'Perception',
    rows: [
      [I('l'), 'Log-odds of a grid cell being occupied; 0 = unknown', ''],
      [`${I('l')}<sub>free</sub>, ${I('l')}<sub>hit</sub>`, 'Log-odds increments for a cell a beam passes through / ends in', ''],
      [`${I('d')}(${I('c')})`, `Distance from cell ${I('c')} to the nearest occupied cell (distance transform)`, 'm'],
      [`${I('r')}<sub>lethal</sub>`, 'Cells closer than this to an obstacle are forbidden (0.4 m)', 'm'],
      ['σ<sub>lidar</sub>', 'Lidar range noise standard deviation', 'm']
    ]
  },
  {
    id: 'mis',
    title: 'Mission',
    rows: [
      [`${I('C')}<sub>ij</sub>`, `Path cost from goal ${I('i')} to ${I('j')} (Dijkstra on the costmap), used to order goals`, 'm'],
      ['σ<sub>pos</sub>', 'Position uncertainty, √(Σ<sub>xx</sub> + Σ<sub>yy</sub>), checked by the lost guard', 'm']
    ]
  },
  {
    id: 'plan',
    title: 'Planning',
    rows: [
      [`${I('g')}(${I('n')})`, `Cost-to-come of search node ${I('n')}`, 'm'],
      [`${I('h')}(${I('n')})`, 'Heuristic estimate of the cost-to-go', 'm'],
      [`${I('f')}(${I('n')})`, `Search priority, ${I('g')} + ε${I('h')}`, 'm'],
      ['ε', 'Heuristic weight; ε > 1 gives weighted A*, with cost ≤ ε × optimal', ''],
      [I('n'), 'Number of nodes in the RRT* tree', ''],
      [`${I('r')}<sub>n</sub>`, 'RRT* rewiring radius, min(8√(log n / n), 1.5 m)', 'm'],
      ['L, R, S', 'Reeds–Shepp segments: left arc, right arc, straight', ''],
      ['⁺, ⁻', 'Segment driven forward / in reverse', ''],
      [I('p'), 'Fraction of δ<sub>max</sub> the car planners may use', ''],
      [`${I('R')}<sub>plan</sub>`, `Planning turning radius, ${I('L')} / tan(${I('p')} δ<sub>max</sub>)`, 'm']
    ]
  },
  {
    id: 'ctl',
    title: 'Path tracking',
    rows: [
      [I('s'), 'Arc length along the path', 'm'],
      [`${I('e')}, ${I('e')}<sub>lat</sub>`, 'Lateral (cross-track) error, positive to the left of the path', 'm'],
      [`${I('e')}<sub>lon</sub>`, 'Along-track error', 'm'],
      ['θ<sub>e</sub>', 'Heading error relative to the path tangent', 'rad'],
      [`${I('L')}<sub>d</sub>`, `Pure-pursuit lookahead, ${I('L')}<sub>0</sub> + ${I('k')}·${I('v')}`, 'm'],
      [`${I('L')}<sub>0</sub>, ${I('k')}`, 'Lookahead offset and speed gain', 'm, s'],
      ['α', 'In pure pursuit: bearing from the heading to the carrot point', 'rad'],
      [`${I('a')}<sub>lat</sub>`, `Lateral-acceleration limit of the speed profile, ${I('v')} ≤ √(${I('a')}<sub>lat</sub>/|κ|)`, 'm/s²'],
      [`${I('k')}<sub>θ</sub>, ${I('k')}<sub>e</sub>`, 'Rear-wheel feedback heading and lateral gains', '1/m, 1/m²'],
      [I('k'), 'In Stanley: cross-track gain', ''],
      [`${I('e')}<sub>front</sub>`, 'Stanley cross-track error of the front axle', 'm'],
      [`${I('K')}<sub>p</sub>, ${I('K')}<sub>i</sub>, ${I('K')}<sub>d</sub>`, 'PID gains on the heading error', ''],
      [`${I('w')}<sub>g</sub>, ${I('w')}<sub>o</sub>, ${I('w')}<sub>v</sub>`, 'DWA weights on goal progress, clearance and speed', ''],
      [I('J'), 'Cost being minimized (DWA score, MPC objective)', '']
    ]
  },
  {
    id: 'mpc',
    title: 'Model predictive control',
    rows: [
      [`${I('N')}<sub>p</sub>`, 'Prediction horizon: steps the model looks ahead', ''],
      [
        `${I('N')}<sub>c</sub>`,
        `Control horizon: free input moves; <b>u</b><sub>k</sub> = <b>u</b><sub>N<sub>c</sub>−1</sub> for ${I('k')} ≥ ${I('N')}<sub>c</sub>`,
        ''
      ],
      [
        '<b>x</b>',
        `MPC state [${I('x')}, ${I('y')}, θ, ${I('v')}, ${I('s')}], plus [${I('v')}<sub>cmd</sub>, ${I('s')}<sub>cmd</sub>] with the lag model`,
        ''
      ],
      [I('s'), 'In the MPC: turn state, ω for diff-drive or δ for the car', 'rad/s or rad'],
      ['<b>u</b>', `MPC input [${I('a')}, ${I('ṡ')}]`, 'm/s², rad/s² or rad/s'],
      ['<b>U</b>', `Decision vector: the ${I('N')}<sub>c</sub> input moves (2${I('N')}<sub>c</sub> variables)`, ''],
      [
        `${I('Q')}<sub>lon</sub>, ${I('Q')}<sub>lat</sub>, ${I('Q')}<sub>θ</sub>, ${I('Q')}<sub>v</sub>`,
        'Weights on along-track, lateral, heading and speed error',
        ''
      ],
      [`${I('w')}<sub>N<sub>p</sub></sub>`, 'Terminal weight multiplier on the last step', ''],
      [`${I('R')}<sub>a</sub>, ${I('R')}<sub>s</sub>`, `Input weights on ${I('a')} and ${I('ṡ')}`, ''],
      [`${I('R')}<sub>Δ</sub>`, 'Weight on the change between consecutive input moves', ''],
      [
        `${I('c')}(<b>x</b>) ≤ 0`,
        `Inequality constraints: speed sign and limit, |${I('s')}| ≤ ${I('s')}<sub>max</sub>, obstacle clearance`,
        ''
      ],
      ['ρ', 'Augmented-Lagrangian penalty parameter', ''],
      ['λ', `Lagrange-multiplier estimates, updated λ ← max(0, λ + ρ${I('c')})`, ''],
      [
        `${I('A')}<sub>k</sub>, ${I('B')}<sub>k</sub>`,
        `Model Jacobians ∂${I('f')}/∂<b>x</b> and ∂${I('f')}/∂<b>u</b> at step ${I('k')}`,
        ''
      ],
      [`${I('S')}<sub>k</sub>`, `Sensitivity of the predicted state to the decision vector, ∂<b>x</b><sub>k</sub>/∂<b>U</b>`, ''],
      [`<b>r</b>, ${I('J')}`, `In Gauss–Newton: residual vector and its Jacobian ∂<b>r</b>/∂<b>U</b>`, ''],
      [`${I('H')}, ${I('g')}`, `In Gauss–Newton: Hessian approximation ${I('J')}ᵀ${I('J')} and gradient ${I('J')}ᵀ<b>r</b>`, '']
    ]
  },
  {
    id: 'map',
    title: 'Map symbols',
    rows: [
      [
        '<i class="swatch" style="background:var(--ink)"></i>',
        'True pose (ground truth); the car is drawn with its wheels at the actual steering angle',
        ''
      ],
      ['<i class="swatch ring" style="border-color:var(--accent)"></i>', 'Estimated pose, dashed outline with a heading line', ''],
      ['<i class="swatch line" style="border-color:var(--accent)"></i>', 'Global path, forward leg; finished legs fade', ''],
      ['<i class="swatch line dash" style="border-color:var(--warn)"></i>', 'Global path, reverse leg (car)', ''],
      [
        '<i class="swatch" style="background:var(--rose)"></i>',
        'Belief: particles (particle filter) or 95 % covariance ellipse (EKF, dead reckoning)',
        ''
      ],
      ['<i class="swatch sq" style="background:var(--amber)"></i>', 'Lidar hits, placed using the estimated pose', ''],
      [
        '<i class="swatch dia" style="background:var(--beacon)"></i>',
        'Beacons (known positions) and the current range–bearing readings drawn from the estimate (not for dead reckoning, which ignores them); red readings are false detections. Hollow: in an outage; grey with a stroke: switched off',
        ''
      ],
      ['<i class="swatch" style="background:var(--warn)"></i>', 'People (ground truth), with a velocity tick', ''],
      [
        '<i class="swatch ring" style="border-color:var(--warn)"></i>',
        'Tracked agent with its ID, as estimated; dashed rings are its predicted positions at 1 s, 2 s, … growing with uncertainty. Grey dashed ring: tentative track',
        ''
      ],
      [
        '<i class="swatch ring" style="border-color:var(--accent)"></i>',
        "Ego predicted positions at 1 s, 2 s, … from the speed plan, MPC or DWA. Matching numbers on the agents' rings are the same instants",
        ''
      ],
      [
        '<i class="swatch ring" style="border-color:var(--ok)"></i>',
        'Active goal; numbers give the visiting order; a dashed body and tick show a goal heading',
        ''
      ],
      [
        '<i class="swatch line" style="border-color:var(--ok)"></i>',
        "MPC predicted trajectory; dots are the reference points. In LTV mode the dashed pink line is the linear model's prediction",
        ''
      ],
      [
        '<i class="swatch sq" style="background:var(--accent);opacity:.4"></i>',
        'Planner search: A* closed set, RRT* tree or Hybrid A* expansions',
        ''
      ],
      ['<i class="swatch" style="background:var(--muted);opacity:.5"></i>', 'DWA rollouts; the chosen one is green, rejected ones red', ''],
      [
        '<i class="swatch line" style="border-color:var(--accent)"></i>',
        'Thin line from the robot: carrot point of pure pursuit, PID or DWA, or the projection point of rear-wheel feedback and Stanley',
        ''
      ]
    ]
  },
  {
    id: 'an',
    title: 'Loop analysis',
    rows: [
      [`${I('L')}(${I('s')})`, 'Open-loop transfer function, broken at the actuator command', ''],
      [`${I('S')}(${I('s')})`, `Sensitivity, 1/(1+${I('L')}); its peak is ${I('M')}<sub>s</sub>`, ''],
      [`${I('T')}(${I('s')})`, 'Closed-loop response of lateral position to a path offset', ''],
      [I('g'), `Plant gain from steering command to heading rate: 1 (diff-drive) or ${I('v')}<sub>0</sub>/${I('L')} (car)`, '1/s per unit'],
      [`${I('v')}<sub>0</sub>`, 'Operating speed of the analysis (the cruise speed)', 'm/s'],
      [
        `${I('K')}<sub>e</sub>, ${I('K')}<sub>θ</sub>`,
        'Linearized controller gains on lateral and heading error, read from the code',
        'per m, per rad'
      ],
      [
        `${I('K')}<sub>s</sub>, ${I('K')}<sub>c</sub>, ${I('K')}<sub>u</sub>`,
        'MPC gains on the actuator state, the commanded state and the previous input move',
        ''
      ],
      [`${I('T')}`, 'Sample time of the simulation, 0.05 s', 's'],
      [`${I('T')}<sub>d</sub>`, `Loop delay: ${I('T')}/2 for the sample-and-hold, plus latency`, 's'],
      [`${I('a')}`, `Fraction of an MPC rate step that reaches a lagging actuator per tick, 1 − e<sup>−T/τ</sup>`, ''],
      [`ω<sub>c</sub>`, `Gain crossover, |${I('L')}(jω<sub>c</sub>)| = 1`, 'rad/s'],
      ['PM', `Phase margin, 180° + ∠${I('L')}(jω<sub>c</sub>)`, '°'],
      ['GM', `Gain margin, −20 log<sub>10</sub>|${I('L')}| where the phase is −180°`, 'dB'],
      ['DM', 'Delay margin, PM/ω<sub>c</sub>: extra latency before instability', 's'],
      [`${I('M')}<sub>s</sub>`, `Peak sensitivity, 1 / (closest distance from ${I('L')} to −1)`, ''],
      [
        `${I('N')}, ${I('P')}, ${I('Z')}`,
        `Nyquist: clockwise encirclements of −1, unstable open-loop poles, unstable closed-loop poles; ${I('Z')} = ${I('N')} + ${I('P')}`,
        ''
      ],
      ['ζ, ω<sub>n</sub>', 'Damping ratio and natural frequency of the dominant closed-loop pole pair', '—, rad/s'],
      [`${I('z')}`, `Discrete-time pole; ${I('s')} = ln ${I('z')} / ${I('T')}`, ''],
      [`π/${I('T')}`, 'Nyquist frequency of the sampled loop (62.8 rad/s)', 'rad/s'],
      [`${I('e')}<sub>ss</sub>`, 'Steady-state lateral error left by a constant actuator bias', 'm']
    ]
  },
  {
    id: 'ag',
    title: 'Moving agents and prediction',
    rows: [
      [
        `<b>x</b><sub>a</sub>`,
        `Agent track state [${I('p')}<sub>x</sub>, ${I('p')}<sub>y</sub>, ${I('v')}<sub>x</sub>, ${I('v')}<sub>y</sub>]`,
        'm, m/s'
      ],
      [I('F'), 'Constant-velocity state transition', ''],
      ['σ<sub>a</sub>', 'Tracker process noise: white acceleration of the constant-velocity model', 'm/s²'],
      ['σ<sub>z</sub>', 'Noise of a detected agent position, 0.1 m', 'm'],
      [`${I('d')}²`, 'Mahalanobis distance that gates track–detection pairs (χ²₂ 99 %: 9.21)', ''],
      [`${I('T')}<sub>p</sub>`, 'Prediction horizon', 's'],
      [`${I('r')}(${I('t')})`, `Predicted agent radius ${I('r')} + ${I('g')}·${I('t')}`, 'm'],
      [I('g'), 'Uncertainty growth of the prediction', 'm/s'],
      [I('s'), 'In the ST graph only: distance ahead along the current path leg', 'm'],
      [`${I('v')}<sub>ref</sub>(${I('s')})`, 'Speed the tracker would use at s: cruise, curvature and stopping limits', 'm/s'],
      [`${I('a')}<sub>c</sub>, ${I('b')}`, 'Acceleration and braking used by the speed planner', 'm/s²'],
      [`${I('T')}<sub>s</sub>`, 'Sensor latency: delay between a reading and its delivery', 's'],
      [
        `${I('A')}, ${I('B')}, τ`,
        'Social force: repulsion strength and range, and the relaxation time toward the desired velocity',
        '—, m, s'
      ],
      [`(${I('i')}, ${I('j')}, ${I('k')})`, 'Space-time A* state: grid cell and time index', '']
    ]
  },
  {
    id: 'tele',
    title: 'Telemetry',
    rows: [
      ['RMS', 'Root mean square over the run', ''],
      ['true error', 'Distance between the true pose and the goal when the robot declares arrival', 'm, °']
    ]
  }
];
