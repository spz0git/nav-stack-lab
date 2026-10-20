// the odometry sliders in physical units, at the cruise speed driving straight (model: odometry() in core/vehicle.js)
function odoInfo() {
  const v = anV0(),
    e = odoErr(v),
    deg = x => (x * 180) / Math.PI,
    at = `At ${v.toFixed(2)} m/s: `;
  if (!P.odoK && !P.odoB) return at + 'no error. Dead reckoning on these readings matches the truth.';
  const noise = P.odoK
    ? `each 50 ms reading is off by σ ${e.sv.toFixed(2)} m/s in speed and ${e.sw.toFixed(2)} rad/s (${deg(e.sw).toFixed(1)}°/s) in turn rate, at random.`
    : 'no random error.';
  const bias = P.odoB
    ? ` Bias: speed reads ${(2 * P.odoB).toFixed(1)} % high (+${(100 * e.bv).toFixed(1)} cm/s), turn rate +${e.bw.toFixed(3)} rad/s (${deg(e.bw).toFixed(2)}°/s), always the same way → about ${Math.round(60 * deg(e.bw))}° of heading drift per minute.`
    : ' No bias.';
  return at + noise + bias;
}
// the car with tyre slip in numbers (model: dynStep() in core/vehicle.js; theory: chapter 1 §4–5)
function dynInfoText() {
  const D = dynInfo(),
    v = Math.min(P.vcruise, P.vmax),
    K = D.K,
    kind = Math.abs(K) < 1e-5 ? 'neutral steer' : K > 0 ? 'understeer' : 'oversteer';
  const sp =
    K > 0
      ? `characteristic speed v_ch ${D.vch.toFixed(2)} m/s (r/δ peaks there, at half of v/L)`
      : K < 0
        ? `critical speed v_crit ${D.vcrit.toFixed(2)} m/s (the yaw motion is unstable above it)`
        : 'no characteristic speed';
  return `K_us ${K.toFixed(4)} rad/(m/s²) (${((K * 180) / Math.PI).toFixed(2)}° per m/s²): ${kind} · ${sp} · grip limit μg ${D.aMax.toFixed(2)} m/s². At the cruise speed ${v.toFixed(2)} m/s: r/δ is ${((100 * D.L) / (D.L + K * v * v)).toFixed(0)} % of v/L, the yaw mode has ${dynModes(v).text}, and the grip runs out on turns tighter than ${((v * v) / D.aMax).toFixed(2)} m (the car steers down to ${minTurnR().toFixed(2)} m).`;
}
const dynPresetOn = n => Object.entries(DYN_PRESETS[n]).every(([k, v]) => P[k] === v);
function dynPreset(n) {
  for (const [k, v] of Object.entries(DYN_PRESETS[n])) setParam(k, v, false);
  renderAllPanes();
}
// The label a choice setting shows for its current value
function segLabel(k) {
  const f = Object.values(SCHEMA)
      .flat()
      .find(x => x.k === k && x.type === 'seg'),
    o = f && (typeof f.opts === 'function' ? f.opts() : f.opts).find(([v]) => v === P[k]);
  return o ? o[1] : P[k];
}
const segShort = k => String(segLabel(k)).replace(/ \(.*\)$/, ''); // without its gloss: "Lidar", "Speed planning"
// Plan → Learned policy: what still runs around the network, for the settings in use
function policyStackNote() {
  const ppl = !agOn()
    ? 'agent tracking is off, so people are only lidar hits in the scan the policy reads'
    : `${segShort('agents')} tracking with ${segLabel('agPred').toLowerCase()} prediction; the policy sees people only as lidar hits, ${
        P.ctl === 'dwa'
          ? 'and DWA scores its arcs against the tracks'
          : P.ctl === 'mpc'
            ? P.spd === 'st'
              ? 'and MPC follows the speed plan made around them'
              : 'and MPC keeps them as constraints'
            : AG_ST_CTL.includes(P.ctl)
              ? P.spd === 'none'
                ? 'and Control → Response to agents is Ignore, so nothing slows down for them'
                : `and Control → Response to agents (${segShort('spd')}) slows the tracker for them`
              : 'and the tracker does not react to them'
      }`;
  const cut =
    S && (S.policyAlt || S.policySnap || S.policyBad || S.policyRepair || S.policyFallback)
      ? ` This run: ${S.policyAlt || 0} lower-scored candidates taken, ${S.policySnap || 0} waypoints moved, ${S.policyRepair || 0} segments rerouted, ${S.policyBad || 0} paths cut, ${S.policyFallback || 0} fallbacks to A*.`
      : '';
  return [
    '<b>Still running while the policy drives</b>',
    `<b>Localize</b> (${segLabel('loc')}): the goal goes into the robot frame and the waypoints back onto the map through the estimated pose, so an estimate that drifts moves the path.`,
    `<b>Perceive</b>, the costmap (${segLabel('per').toLowerCase()}): of the candidate paths, the best-scoring one whose segments keep 10 cm clear of the inflated obstacles drives; when none does, the safety layer moves the best one's waypoints that land in or near the inflation to the nearest clear cell, reroutes a segment that crosses it with a short A* detour (or cuts the path there), and when what is left is too short to drive (the robot pinned against an obstacle, every candidate pushing into it) drives 1.5 m of the A* route instead.${cut}`,
    `<b>People</b>: ${ppl}.`,
    `<b>Plan</b>: ${P.policyGoal === 'subgoal' ? 'A* still searches the map at every refresh, for the subgoal the policy is pointed at.' : 'no search, and nothing else plans.'}`,
    `<b>Control</b> (${segLabel('ctl')}): follows the waypoints.`,
    '<b>Mission</b>: takes the goals in turn and replans on the usual triggers (the event log names each one).'
  ].join('<br>');
}
const SCHEMA = {
  loc: [
    {
      k: 'loc',
      type: 'seg',
      label: 'Estimator',
      opts: [
        ['truth', 'Ground truth'],
        ['dr', 'Dead reckoning'],
        ['ekf', 'EKF'],
        ['pf', 'Particle filter'],
        ['slam', 'EKF-SLAM'],
        ['pgslam', 'Pose-graph SLAM'],
        ['custom', 'Your code']
      ]
    },
    {
      type: 'info',
      text: () => 'Odometry is perfect on this level (noise and bias 0), so dead reckoning matches the truth exactly.',
      show: () => P.loc === 'dr' && !P.odoK && !P.odoB
    },
    {
      type: 'btn',
      label: 'Add odometry noise and bias (×1)',
      act: () => {
        setParam('odoK', 1, false);
        setParam('odoB', 1, false);
        renderAllPanes();
      },
      show: () => P.loc === 'dr' && !P.odoK && !P.odoB
    },
    {
      type: 'info',
      text: () =>
        `EKF-SLAM estimates the beacon positions too: ${S && S.slam ? S.slam.n : 0} mapped. The map starts empty; the first reading of each beacon places it.`,
      show: () => P.loc === 'slam'
    },
    {k: 'scanMatch', type: 'bool', label: 'Lidar scan matching against the prior map', show: () => P.loc === 'ekf'},
    {
      type: 'info',
      text: () =>
        P.per !== 'oracle'
          ? 'Scan matching needs the prior map (Perceive → Map source → prior map): with lidar mapping the map is what the lidar built, and matching the scan to it would only confirm the estimate.'
          : S.sm
            ? `Every 0.2 s the scan is aligned to the map by Gauss–Newton on its distance field and fused as a pose fix. Last match: ${S.sm.n} points, residual ${(100 * S.sm.rms).toFixed(1)} cm, ${S.sm.it} iterations, moved the estimate ${(100 * S.sm.dx).toFixed(1)} cm, σ ${(100 * Math.sqrt(S.sm.cov[0])).toFixed(1)} × ${(100 * Math.sqrt(S.sm.cov[4])).toFixed(1)} cm${S.sm.ok ? '' : S.sm.poor ? ` — a poor fit (${S.sm.n} of ${S.sm.hits} hits near a wall), not fused` : S.sm.still ? ', not fused (the robot has not moved since the last fix)' : S.sm.d2 != null ? `, rejected by the gate (d² ${S.sm.d2.toFixed(0)})` : ''}.`
            : 'Every 0.2 s the scan is aligned to the prior map by Gauss–Newton on its distance field and fused as a pose fix with the covariance of the fit, gated like a beacon reading.',
      show: () => P.loc === 'ekf' && P.scanMatch
    },
    {
      type: 'info',
      text: () => {
        const G = S && S.pg;
        if (!G) return '';
        const last = G.last
          ? ` Last: keyframe ${G.last.j} ↔ ${G.last.i} at ${G.last.t.toFixed(1)} s, correction ${(100 * G.last.corr).toFixed(0)} cm, ${(100 * G.last.inl).toFixed(0)} % of the hits paired.`
          : '';
        const opt = G.opt ? ` Optimization: ${G.opt.it} iterations, ${G.opt.ms.toFixed(0)} ms, χ² ${G.opt.chi2.toFixed(1)}.` : '';
        return `Lidar only, the beacons ignored. ${G.nodes.length} keyframes (${G.matched} placed by matching the scan to the map so far), ${G.loops} loop closure${G.loops === 1 ? '' : 's'}.${last}${opt}${P.per !== 'mapping' ? ' With a prior map the graph still runs, but there is no map to correct: Perceive → lidar mapping shows the point of it.' : ''}`;
      },
      show: () => P.loc === 'pgslam'
    },
    {k: 'pgKf', label: 'Keyframe spacing', min: 0.2, max: 2, step: 0.1, unit: 'm', show: () => P.loc === 'pgslam'},
    {k: 'pgMatch', type: 'bool', label: 'Scan-to-map matching at every keyframe', show: () => P.loc === 'pgslam'},
    {k: 'pgLoop', type: 'bool', label: 'Loop closures (scan-to-scan ICP against earlier keyframes)', show: () => P.loc === 'pgslam'},
    {
      type: 'info',
      text: () =>
        SLOTS.loc.worker
          ? 'Your localizer is loaded (Code tab).'
          : 'No localizer loaded: the estimate stays at the start pose. <button type="button" class="linkbtn" data-code="loc/ekf">Open the Code tab with the EKF example</button>',
      show: () => P.loc === 'custom'
    },
    {
      k: 'assoc',
      type: 'seg',
      label: 'Beacon association',
      opts: [
        ['known', 'Known IDs'],
        ['unknown', 'Unlabeled']
      ],
      show: () => filt() || P.loc === 'slam'
    },
    {k: 'npart', label: 'Particles', min: 50, max: 2000, step: 50, show: pf_},
    {k: 'inject', type: 'bool', label: 'Recovery injection (augmented MCL + sensor resetting)', show: pf_},
    {
      k: 'pfLidar',
      type: 'bool',
      label: 'Also weight particles by lidar against the prior map (likelihood field)',
      show: () => pf_() && P.per === 'oracle'
    },
    {k: 'filtK', label: "Filter's assumed motion noise", min: 0.25, max: 6, step: 0.25, unit: '× true', show: () => P.loc !== 'truth'},
    {type: 'btn', label: 'Scatter particles', act: () => scatterParticles(), show: pf_},
    {
      type: 'info',
      text: () =>
        'Dead reckoning never uses the beacons: it integrates odometry only, so its error and ellipse only grow. Switch to EKF or the particle filter to see beacons pull the estimate back.',
      show: () => P.loc === 'dr'
    },
    {
      type: 'info',
      text: () =>
        'Ground truth: the estimate is the true pose, so the beacons and their on/off state change nothing here (L1, L2 and L6 start this way). Pick EKF or Particle filter to see what the beacons are worth.',
      show: () => P.loc === 'truth'
    },
    {
      type: 'btn',
      label: 'Use the EKF (beacons only)',
      act: () => {
        setParam('loc', 'ekf', false);
        renderAllPanes();
      },
      show: () => P.loc === 'truth'
    },
    {type: 'head', label: 'Odometry (wheel encoders)'},
    {k: 'odoK', label: 'Odometry noise (× base σ)', min: 0, max: 3, step: 0.1, unit: '×'},
    {k: 'odoB', label: 'Odometry calibration bias (× base bias)', min: 0, max: 3, step: 0.1, unit: '×'},
    {type: 'info', text: odoInfo},
    {type: 'head', label: 'Yaw-rate gyro'},
    {
      k: 'gyro',
      type: 'bool',
      label:
        "Yaw-rate gyro: the turn rate comes from a gyro instead of the wheels (the car with tyre slip: instead of the steering encoder, so slip no longer reads as odometry error); its own noise and bias, none of the wheels'"
    },
    {k: 'gyroSig', label: 'Gyro noise σ per reading', min: 0, max: 3, step: 0.05, unit: '°/s', show: () => P.gyro},
    {k: 'gyroBias', label: 'Gyro bias (the filter is not told)', min: 0, max: 2, step: 0.05, unit: '°/s', show: () => P.gyro},
    {
      k: 'zupt',
      type: 'bool',
      label:
        'Zero-velocity update: average the gyro while standing still into a bias estimate and subtract it (the robot holds still for the first 2 s of a run to calibrate)',
      show: () => P.gyro
    },
    {
      type: 'info',
      text: () =>
        `Heading drift from the gyro alone at the cruise speed: noise σ ${P.gyroSig.toFixed(2)}°/s per reading walks about ${(P.gyroSig * Math.sqrt(60 / 0.05) * 0.05).toFixed(1)}° in a minute; a bias of ${P.gyroBias.toFixed(2)}°/s drifts ${(60 * P.gyroBias).toFixed(0)}° in a minute${P.zupt ? `, of which the zero-velocity update removes what it has learnt at stops (estimate now ${((S.gyroBiasEst * 180) / Math.PI).toFixed(2)}°/s)` : ''}.`,
      show: () => P.gyro
    },
    {type: 'head', label: 'Beacons'},
    {type: 'beacons', label: 'Beacons on (tap to switch one off)'},
    {type: 'bsensor'},
    {
      type: 'info',
      text: () =>
        `The particle filter scores particles with lidar against the prior map as well as with the beacons, so it stays localized with every beacon off (lidar localization, as AMCL does). Untick "Also weight particles by lidar" above to depend on the beacons alone.`,
      show: () => P.loc === 'pf' && P.pfLidar && P.per === 'oracle'
    },
    {k: 'lmK', label: 'Beacon range/bearing noise', min: 0, max: 3, step: 0.1, unit: '×'},
    {k: 'lmRange', label: 'Beacon sensor range', min: 2, max: 15, step: 0.5, unit: 'm'},
    {k: 'clutter', label: 'False beacon detections per scan (unlabeled mode)', min: 0, max: 3, step: 0.1},
    {
      k: 'bOut',
      label: 'Random beacon outages (share of time each is down)',
      min: 0,
      max: 90,
      step: 5,
      unit: '%',
      show: () => P.loc !== 'truth'
    },
    {
      k: 'bOutLen',
      label: 'Mean outage length (short = flicker)',
      min: 0.2,
      max: 10,
      step: 0.2,
      unit: 's',
      show: () => P.loc !== 'truth' && P.bOut > 0
    }
  ],
  per: [
    {
      k: 'per',
      type: 'seg',
      label: 'Map source',
      opts: [
        ['oracle', 'Prior map'],
        ['mapping', 'Lidar mapping']
      ]
    },
    {
      k: 'unknownAs',
      type: 'seg',
      label: 'Unknown space is',
      opts: [
        ['free', 'Free (optimistic)'],
        ['lethal', 'Lethal (cautious)']
      ],
      show: () => P.per === 'mapping'
    },
    {
      type: 'info',
      text: () =>
        "Lethal: the planners plan only through cells the lidar has already seen free (and 0.4 m clear of unseen ones). At the start that is what one scan covers, at most the lidar's 8 m and nothing behind a wall. A goal farther away or in an unseen room is approached through what has been seen: the robot heads for the edge of the seen floor nearest the goal, replans every second as the map grows, and plans to the goal itself once it is on seen floor (the event log says when). Mission → Explore maps the whole floor the same way, with no goals given. With Free the planner goes optimistically and replans as walls appear.",
      show: () => P.per === 'mapping' && P.unknownAs === 'lethal'
    },
    {k: 'infl', label: 'Inflation band beyond lethal', min: 0, max: 1.5, step: 0.05, unit: 'm'},
    {k: 'lidarSig', label: 'Lidar range noise σ', min: 0, max: 0.15, step: 0.005, unit: 'm'},
    {
      type: 'btn',
      label: 'Clear built map',
      act: () => {
        S.lo.fill(0);
        buildCostmap();
        dirty.occ = true;
        logE('Occupancy grid cleared', 'warn');
        draw();
      },
      show: () => P.per === 'mapping'
    },
    {
      k: 'agents',
      type: 'seg',
      label: 'Agent tracking',
      opts: [
        ['off', 'Off'],
        ['truth', 'Ground truth'],
        ['lidar', 'Lidar (clusters + Kalman)'],
        ['learned', 'Learned detector + Kalman']
      ]
    },
    {
      type: 'info',
      text: () => {
        const ids = LEVELS.filter(l => l.peds.length).map(l => l.id);
        return `People prediction (constant velocity, the learned predictor, or your code) is set here once agent tracking is on. Tracking is on by default on ${ids.join(' and ')}, the levels with people. <button type="button" class="linkbtn" data-setp="agents:lidar">Turn on lidar tracking</button>`;
      },
      show: () => !agOn()
    },
    {
      type: 'info',
      text: () => {
        const M = nnModel('detector');
        if (!M) return 'No detector model in this build: train one in Tools → Train, or with training/detector/train.py and rebuild.';
        const mine = M !== MODELS.detector;
        return `A 1D convolution over the beams (${M.params} parameters, ${mine ? `trained in this browser (Tools → Train) on ${M.trained_on ? M.trained_on.scans : '?'} scans` : `trained in training/detector on ${M.trained_on.scans} simulated scans`}) labels each beam "person" or "static" from the shape and motion of the hits${M.layers[0].cin > 6 ? ', weighed against how well the map explains each hit: it learned how far to trust the map, so it keeps working while the map is being built or the pose estimate drifts' : ' alone: it never reads the map'}. Hits are coloured rose above its threshold (${M.threshold || (M.layers[0].cin > 6 ? DET_THR : 0.6)}). Retrain it, or train another shape, in Tools → Train.`;
      },
      show: () => P.agents === 'learned'
    },
    {
      k: 'detModel',
      type: 'seg',
      label: 'Detector model',
      opts: () => trnOpts('detector'),
      show: () => P.agents === 'learned'
    },
    {
      k: 'agICP',
      type: 'bool',
      label: "Per-target scan matching (the person's hits aligned frame to frame give its velocity)",
      show: () => P.agents === 'lidar' || P.agents === 'learned'
    },
    {
      k: 'agPred',
      type: 'seg',
      label: 'Prediction',
      opts: [
        ['cv', 'Constant velocity'],
        ['static', 'Static (frozen)'],
        ['learned', 'Learned (network)'],
        ['custom', 'Your code']
      ],
      show: agOn
    },
    {
      type: 'info',
      text: () => {
        const M = nnModel('predictor');
        if (!M)
          return 'No predictor model in this build: train one in Tools → Train, or with training/predictor/train.py and rebuild. Constant velocity is used.';
        const mine = M !== MODELS.predictor;
        return `A multilayer perceptron (${M.params} parameters, ${mine ? `trained in this browser (Tools → Train) on ${M.trained_on ? M.trained_on.samples : '?'} samples` : `trained in training/predictor on ${M.trained_on.samples} tracked people`}) reads each track's last second, where the robot is and how it moves, and the free space around the person, and draws three futures for the next 3 s with a probability each (bold: likely). The grey dashed line is constant velocity. The metrics show both predictors' error at 1 s and 2 s against where the people really went.`;
      },
      show: () => agOn() && P.agPred === 'learned'
    },
    {
      k: 'predModel',
      type: 'seg',
      label: 'Predictor model',
      opts: () => trnOpts('predictor'),
      show: () => agOn() && P.agPred === 'learned'
    },
    {
      k: 'predModes',
      type: 'seg',
      label: 'Plan against',
      opts: [
        ['top', 'The most probable future'],
        ['all', 'Every future ≥ 20 %']
      ],
      show: () => agOn() && P.agPred === 'learned'
    },
    {
      type: 'info',
      text: () =>
        SLOTS.pred.worker
          ? 'Your predictor is loaded (Code tab).'
          : 'No predictor loaded: constant velocity is used. <button type="button" class="linkbtn" data-code="pred/cv">Open the Code tab with the constant-velocity example</button>',
      show: () => agOn() && P.agPred === 'custom'
    },
    {k: 'agT', label: 'Prediction horizon T_p', min: 1, max: 6, step: 0.5, unit: 's', show: agOn},
    {
      k: 'agGrow',
      label: 'Prediction uncertainty growth g',
      min: 0,
      max: 0.5,
      step: 0.05,
      unit: 'm/s',
      show: () => agOn() && (P.agPred === 'cv' || P.agPred === 'learned')
    },
    {
      k: 'agSigA',
      label: 'Tracker process noise σ_a',
      min: 0.1,
      max: 3,
      step: 0.1,
      unit: 'm/s²',
      show: () => P.agents === 'lidar' || (P.radar && P.trkIn !== 'lidar')
    },
    {
      k: 'weather',
      type: 'seg',
      label: 'Weather',
      opts: [
        ['clear', 'Clear'],
        ['rain', 'Rain'],
        ['fog', 'Fog']
      ]
    },
    {
      type: 'info',
      text: () =>
        P.weather === 'fog'
          ? "Fog: the lidar's returns fade beyond about 4 m (of its 8), one beam in seven returns nothing, the ranges are noisier, and now and then a beam returns from the fog itself, under 2 m out. The radar does not notice."
          : 'Rain: the lidar fades beyond about 6 m, drops one beam in sixteen and now and then returns from a drop. The radar loses a tenth of its reach and sees a few more false detections.',
      show: () => P.weather !== 'clear'
    },
    {k: 'radar', type: 'bool', label: 'Radar (forward: range, bearing and radial velocity per detection)'},
    {
      type: 'info',
      text: () =>
        `A ${P.radFov}° radar reaching ${P.radRange} m ahead, 10 Hz: each detection is a range (σ 0.1 m), a bearing (σ 3°) and a radial velocity (σ 0.1 m/s) from the Doppler shift, drawn as a diamond with an arrow for the radial velocity (toward the robot: closing). A person gives one echo, a wall a few where it faces the radar; false detections and ghosts (an echo that bounced off a wall) are drawn the same way, since the robot cannot tell them apart. Two echoes closer than ${P.radRes}° in bearing, 0.4 m in range and 0.25 m/s in radial velocity are one detection.${P.trkIn === 'lidar' ? ' The people tracker does not use it until Tracker inputs says so.' : ''}`,
      show: radarOn
    },
    {k: 'radFov', label: 'Radar field of view', min: 30, max: 180, step: 10, unit: '°', show: radarOn},
    {k: 'radRange', label: 'Radar reach', min: 5, max: 30, step: 1, unit: 'm', show: radarOn},
    {k: 'radRes', label: 'Radar angular resolution', min: 1, max: 20, step: 1, unit: '°', show: radarOn},
    {k: 'radClutter', label: 'Radar false detections per scan', min: 0, max: 20, step: 0.5, unit: '', show: radarOn},
    {k: 'radGhost', label: 'Radar ghosts: chance per person per scan', min: 0, max: 50, step: 1, unit: '%', show: radarOn},
    {
      k: 'trkIn',
      type: 'seg',
      label: 'Tracker inputs',
      opts: [
        ['lidar', 'Lidar'],
        ['radar', 'Radar'],
        ['both', 'Lidar + radar']
      ],
      show: () => radarOn() && agOn() && P.agents !== 'truth'
    }
  ],
  mis: [
    {
      k: 'mis',
      type: 'seg',
      label: 'Goal order',
      opts: [
        ['sequential', 'In order'],
        ['greedy', 'Greedy nearest'],
        ['optimal', 'Optimal'],
        ['explore', 'Explore (frontiers)']
      ]
    },
    {
      type: 'info',
      text: () =>
        P.mis === 'explore'
          ? P.per === 'mapping'
            ? `Frontier exploration: the robot picks its own goals, the largest nearby frontier (known free next to unknown, at least ${P.exploreMin} cells), until none is left. The goals on the map are ignored; the status strip shows the floor seen.`
            : 'Exploration needs lidar mapping: Perceive → Map source → lidar mapping. With a prior map there is nothing unknown to explore.'
          : '',
      show: () => P.mis === 'explore'
    },
    {k: 'exploreMin', label: 'Smallest frontier worth a visit', min: 2, max: 30, step: 1, unit: 'cells', show: () => P.mis === 'explore'},
    {k: 'replan', label: 'Periodic replan (0 = event-driven only)', min: 0, max: 5, step: 0.5, unit: 's'},
    {k: 'lostGuard', type: 'bool', label: 'Stop when position σ exceeds 1 m (diff-drive also turns in place)'},
    {k: 'misLoop', type: 'bool', label: 'Repeat the goals: after the last one start again, lap after lap', show: () => P.mis !== 'explore'},
    {type: 'head', label: 'Map'},
    {
      k: 'map',
      type: 'seg',
      label: 'Obstacles',
      opts: [
        ['level', "The level's"],
        ['empty', 'Empty floor']
      ]
    },
    {type: 'info', text: () => mapInfo()},
    {
      type: 'btn',
      label: 'Clear painted and erased',
      act: () => {
        setParam('mapDel', '', false);
        setParam('mapAdd', '', false);
        logE('Map edits cleared');
        renderAllPanes();
      },
      show: () => !!(P.mapAdd || P.mapDel)
    }
  ],
  plan: [
    {
      k: 'plan',
      type: 'seg',
      label: 'Global planner',
      opts: () => [
        ['straight', 'Straight line'],
        ['astar', 'A*'],
        ['dstar', 'D* Lite'],
        ['rrtstar', 'RRT*'],
        ['policy', 'Learned policy (end-to-end)'],
        ...(isCar()
          ? [
              ['rs', 'Reeds–Shepp'],
              ['hybrid', 'Hybrid A*']
            ]
          : [['stastar', 'Space-time A*']]),
        ['custom', 'Your code']
      ]
    },
    {
      type: 'info',
      text: () => {
        const M = nnModel('policy');
        if (!M) return 'No policy model in this build: train one in Tools → Train, or with training/policy/train.py and rebuild.';
        const mine = M !== MODELS.policy;
        return `An end-to-end policy: the scan (with the nearest range per 30° sector), the odometry and the goal in the robot frame go into a multilayer perceptron (${M.params} parameters, ${mine ? `trained in this browser (Tools → Train) on ${M.trained_on ? M.trained_on.samples : '?'} samples` : `behaviour-cloned in training/policy from ${M.trained_on.samples} moments of the classical stack's driving`}) and ${policyK(M) > 1 ? `${policyK(M)} candidate paths of eight waypoints over the next 4 s come out, each with a score; the best-scoring one that clears the costmap drives (the others are drawn faint on the map)` : 'eight waypoints over the next 4 s come out'}, refreshed every 0.5 s. The network takes the global planner's place and reads no map; the rest of the stack runs as before (below).`;
      },
      show: () => P.plan === 'policy'
    },
    {
      type: 'info',
      text: () => policyStackNote(),
      show: () => P.plan === 'policy'
    },
    {
      k: 'polModel',
      type: 'seg',
      label: 'Policy model',
      opts: () => trnOpts('policy'),
      show: () => P.plan === 'policy'
    },
    {
      k: 'policyGoal',
      type: 'seg',
      label: 'What the policy is pointed at',
      opts: [
        ['final', 'The mission goal'],
        ['subgoal', 'A subgoal 3 m along the A* route']
      ],
      show: () => P.plan === 'policy'
    },
    {
      type: 'info',
      text: () => {
        const D = S && S.dstar;
        if (!D)
          return 'D* Lite keeps its search between plans: the first plan costs what A* costs, a replan only repairs the vertices the map change touched.';
        return `The search is kept across the ${D.plans} plan${D.plans === 1 ? '' : 's'} on this goal; the last one${D.changed ? `, after ${D.changed} cells changed,` : ''} took ${D.exp} vertex update${D.exp === 1 ? '' : 's'}.`;
      },
      show: () => P.plan === 'dstar'
    },
    {
      type: 'btn',
      label: 'Step through the last search',
      act: () => searchPlayStart(true),
      show: () => !!(S && S.searchTrace && S.searchTrace.n)
    },
    {
      type: 'info',
      text: () =>
        "Space-time A* plans (x, y, t) on a 0.2 m grid against the agents' predicted positions over the prediction horizon, and waits when that is cheaper than a detour. It needs agent tracking (Perceive).",
      show: () => P.plan === 'stastar'
    },
    {
      type: 'info',
      text: () =>
        SLOTS.plan.worker
          ? 'Your planner is loaded (Code tab).'
          : 'No planner loaded: every plan fails. <button type="button" class="linkbtn" data-code="plan/astar">Open the Code tab with the A* example</button>',
      show: () => P.plan === 'custom'
    },
    {
      type: 'info',
      text: () => "A* and RRT* plan for a point with clearance. They ignore the car's heading, body and turning radius.",
      show: () => isCar() && (P.plan === 'astar' || P.plan === 'rrtstar')
    },
    {type: 'info', text: () => 'Reeds–Shepp ignores obstacles entirely.', show: () => P.plan === 'rs'},
    {
      k: 'planPct',
      label: 'Steering used by the planner',
      min: 50,
      max: 100,
      step: 5,
      unit: '% of δ_max',
      show: () => isCar() && (P.plan === 'hybrid' || P.plan === 'rs')
    },
    {
      type: 'info',
      text: () => `Planning radius ${planR().toFixed(2)} m (vehicle minimum ${minTurnR().toFixed(2)} m)`,
      show: () => isCar() && (P.plan === 'hybrid' || P.plan === 'rs')
    },
    {k: 'eps', label: 'Heuristic weight ε', min: 1, max: 5, step: 0.25, show: () => P.plan === 'astar' || P.plan === 'hybrid'},
    {
      k: 'hybH',
      type: 'seg',
      label: 'Hybrid A* heuristic',
      opts: [
        ['both', 'max(2D, Reeds–Shepp)'],
        ['2d', '2D Dijkstra only']
      ],
      show: () => P.plan === 'hybrid'
    },
    {k: 'revOK', type: 'bool', label: 'Allow reversing', show: () => P.plan === 'hybrid'},
    {k: 'revPen', label: 'Reverse cost multiplier', min: 1, max: 5, step: 0.1, unit: '×', show: () => P.plan === 'hybrid' && P.revOK},
    {k: 'gearPen', label: 'Gear-change penalty', min: 0, max: 10, step: 0.5, unit: 'm', show: () => P.plan === 'hybrid' && P.revOK},
    {k: 'rrtIt', label: 'RRT* samples', min: 300, max: 4000, step: 100, show: () => P.plan === 'rrtstar'},
    {k: 'smooth', type: 'bool', label: 'Line-of-sight shortcut smoothing', show: () => P.plan === 'astar' || P.plan === 'rrtstar'},
    {k: 'agPlan', type: 'bool', label: 'When the speed planner reports an agent blocking the path, replan around its predicted positions'},
    {
      type: 'btn',
      label: 'Replan now',
      act: () => {
        if (S.fsm.queue.length) {
          S.fsm.state = 'PLAN';
          S.fsm.pendingReason = 'manual';
          advanceMission();
        }
      }
    }
  ],
  ctl: [
    {
      k: 'ctl',
      type: 'seg',
      label: 'Path tracker',
      opts: () => [
        ['pp', 'Pure pursuit'],
        ['rwf', 'Rear-wheel feedback'],
        ...(isCar() ? [['stanley', 'Stanley']] : []),
        ['pid', isCar() ? 'PID steering' : 'PID heading'],
        ['dwa', 'DWA'],
        ['mpc', 'MPC'],
        ['custom', 'Your code']
      ]
    },
    {
      type: 'info',
      text: () =>
        SLOTS.ctl.worker
          ? 'Your controller is loaded (Code tab).'
          : 'No controller loaded: the robot stands still. <button type="button" class="linkbtn" data-code="ctl/pp">Open the Code tab with the pure pursuit example</button>',
      show: () => P.ctl === 'custom'
    },
    {
      k: 'vcruise',
      label: 'Cruise speed (reference profile)',
      min: 0.2,
      max: () => (isDyn() ? 4 : 2),
      step: 0.05,
      unit: 'm/s',
      show: () => P.ctl !== 'custom'
    },
    {
      k: 'spd',
      type: 'seg',
      label: 'Response to agents',
      opts: () =>
        P.ctl === 'mpc'
          ? [
              ['none', 'Constraints only'],
              ['st', 'Speed planning (ST graph)']
            ]
          : [
              ['none', 'Ignore'],
              ['vo', 'Velocity obstacles'],
              ['stop', 'Reactive stop'],
              ['st', 'Speed planning (ST graph)']
            ],
      show: () => AG_ST_CTL.includes(P.ctl)
    },
    {
      type: 'info',
      text: () => 'Speed planning needs agent tracking: Perceive → Agent tracking.',
      show: () => AG_ST_CTL.includes(P.ctl) && P.spd === 'st' && !agOn()
    },
    {
      type: 'info',
      text: () =>
        `Each tracked person's cone of colliding velocities, within the horizon; a command inside one is moved to the nearest sampled velocity outside all of them.${S && S.voN ? ` This run: ${S.voN} interventions, ${S.voStops || 0} stops.` : ''}`,
      show: () => P.spd === 'vo'
    },
    {k: 'voT', label: 'Velocity-obstacle horizon τ', min: 1, max: 6, step: 0.5, unit: 's', show: () => P.spd === 'vo'},
    {k: 'voMargin', label: 'Clearance added to the radii', min: 0, max: 0.6, step: 0.05, unit: 'm', show: () => P.spd === 'vo'},
    {k: 'stMarg', label: 'Clearance kept from predicted agents', min: 0, max: 1, step: 0.05, unit: 'm', show: stActive},
    {
      type: 'info',
      text: () =>
        P.ctl === 'mpc'
          ? 'MPC adds a clearance constraint per footprint circle and step against the nearest predicted agent (NMPC with obstacle constraints); with speed planning its reference also follows the ST profile.'
          : "DWA checks each rollout against the agents' predicted positions at the same time step.",
      show: () => (P.ctl === 'dwa' || P.ctl === 'mpc') && agOn()
    },
    {
      k: 'guard',
      type: 'bool',
      label: 'Lidar safety stop: slow down for scan points on the commanded arc',
      show: () => GUARD_CTL.includes(P.ctl)
    },
    {
      type: 'info',
      text: () =>
        "Path trackers follow the path and never read the lidar; the path is only as good as the map, and a map built on a drifting estimate puts walls in the wrong place. The safety stop sweeps the footprint along the arc the tracker commands, against this scan (its points are where the lidar measured them, relative to the robot), and caps the speed at what stops in time, like a robot's collision monitor. Stopped, the robot replans after 5 s. DWA and MPC check the scan themselves.",
      show: () => GUARD_CTL.includes(P.ctl) && P.guard
    },
    {k: 'ppL0', label: 'Lookahead L<sub>0</sub>', min: 0.1, max: 2.5, step: 0.05, unit: 'm', show: () => P.ctl === 'pp' || P.ctl === 'pid'},
    {
      k: 'ppK',
      label: 'Lookahead gain k (L = L<sub>0</sub> + k·v)',
      min: 0,
      max: 2,
      step: 0.05,
      unit: 's',
      show: () => P.ctl === 'pp' || P.ctl === 'pid'
    },
    {
      k: 'alat',
      label: 'Lateral accel limit',
      min: 0.1,
      max: () => (isDyn() ? 8 : 2),
      step: 0.05,
      unit: 'm/s²',
      show: () => P.ctl === 'pp' || P.ctl === 'stanley' || P.ctl === 'rwf' || P.ctl === 'mpc'
    },
    {k: 'rwKth', label: 'Heading gain k_θ', min: 0, max: 6, step: 0.1, unit: '1/m', show: () => P.ctl === 'rwf'},
    {k: 'rwKe', label: 'Lateral gain k_e', min: 0, max: 12, step: 0.1, unit: '1/m²', show: () => P.ctl === 'rwf'},
    {k: 'stanK', label: 'Stanley gain k', min: 0.1, max: 8, step: 0.1, show: () => P.ctl === 'stanley'},
    {type: 'info', text: () => 'Reverse legs use pure pursuit.', show: () => P.ctl === 'stanley'},
    {k: 'kp', label: 'Kp', min: 0, max: 8, step: 0.1, show: () => P.ctl === 'pid'},
    {k: 'ki', label: 'Ki', min: 0, max: 3, step: 0.05, show: () => P.ctl === 'pid'},
    {k: 'kd', label: 'Kd', min: 0, max: 1, step: 0.01, show: () => P.ctl === 'pid'},
    {k: 'dwaG', label: 'Goal weight', min: 0, max: 3, step: 0.05, show: () => P.ctl === 'dwa'},
    {k: 'dwaO', label: 'Clearance weight', min: 0, max: 3, step: 0.05, show: () => P.ctl === 'dwa'},
    {k: 'dwaV', label: 'Speed weight', min: 0, max: 3, step: 0.05, show: () => P.ctl === 'dwa'},
    {k: 'dwaT', label: 'Rollout horizon', min: 0.5, max: 3, step: 0.1, unit: 's', show: () => P.ctl === 'dwa'},
    {
      k: 'mpcMode',
      type: 'seg',
      label: 'MPC formulation',
      opts: [
        ['nmpc', 'Nonlinear (NMPC)'],
        ['ltv', 'Linearized about reference (LTV)']
      ],
      show: mpc_
    },
    {k: 'mpcNp', label: 'Prediction horizon Np', min: 3, max: 40, step: 1, unit: 'steps', show: mpc_},
    {k: 'mpcNc', label: 'Control horizon Nc (free moves, then held)', min: 1, max: 40, step: 1, unit: 'steps', show: mpc_},
    {k: 'mpcDt', label: 'Prediction step Δt', min: 0.05, max: 0.3, step: 0.05, unit: 's', show: mpc_},
    {
      type: 'info',
      text: () => {
        const np = Math.round(P.mpcNp),
          nc = Math.min(Math.round(P.mpcNc), np);
        return `Looks ${(np * P.mpcDt).toFixed(1)} s ahead with ${nc} free input move${nc > 1 ? 's' : ''} (${(nc * P.mpcDt).toFixed(1)} s); ${2 * nc} decision variables.${P.mpcNc > P.mpcNp ? ' Nc is capped at Np.' : ''}`;
      },
      show: mpc_
    },
    {k: 'mpcIt', label: 'SQP iterations per tick', min: 1, max: 10, step: 1, show: () => mpc_() && P.mpcMode === 'nmpc'},
    {k: 'mpcBudget', label: 'Real-time budget per solve (0: none)', min: 0, max: 50, step: 1, unit: 'ms', show: mpc_},
    {k: 'mpcQlat', label: 'Weight: lateral error', min: 0, max: 100, step: 1, show: mpc_},
    {k: 'mpcQlon', label: 'Weight: along-track error', min: 0, max: 50, step: 0.5, show: mpc_},
    {k: 'mpcQth', label: 'Weight: heading error', min: 0, max: 50, step: 0.5, show: mpc_},
    {k: 'mpcQv', label: 'Weight: speed error', min: 0, max: 20, step: 0.5, show: mpc_},
    {k: 'mpcQf', label: 'Terminal weight multiplier', min: 1, max: 30, step: 1, unit: '×', show: mpc_},
    {k: 'mpcRa', label: 'Input weight: acceleration', min: 0, max: 5, step: 0.05, show: mpc_},
    {k: 'mpcRs', label: 'Input weight: steering rate (car) / angular accel', min: 0, max: 5, step: 0.05, show: mpc_},
    {k: 'mpcRd', label: 'Input change weight (Δu between moves)', min: 0, max: 10, step: 0.1, show: mpc_},
    {k: 'mpcRho', label: 'Constraint penalty ρ (augmented Lagrangian)', min: 10, max: 1000, step: 10, show: mpc_},
    {
      k: 'mpcObs',
      type: 'bool',
      label: 'Obstacle constraints from lidar (nonconvex, NMPC only)',
      show: () => mpc_() && P.mpcMode === 'nmpc'
    },
    {
      k: 'mpcMarg',
      label: 'Obstacle margin',
      min: 0,
      max: 0.5,
      step: 0.01,
      unit: 'm',
      show: () => mpc_() && P.mpcMode === 'nmpc' && P.mpcObs
    },
    {k: 'mpcLag', type: 'bool', label: 'Include actuator lag τ in the prediction model (adds 2 states)', show: mpc_},
    {
      k: 'mpcDyn',
      type: 'bool',
      label: 'Tyre model in the prediction (dynamic bicycle: sideslip v_y and yaw rate r, adds 2 states)',
      show: () => mpc_() && isDyn()
    },
    {
      type: 'info',
      text: () =>
        P.mpcDyn
          ? "The MPC predicts with the simulator's tyre model: the car turns less than its wheels point, later, and no harder than μg allows, so it starts a swerve earlier and steers further than the kinematic model would. It reads v_y and r as a gyro and a sideslip estimator would give them."
          : 'The MPC predicts with the kinematic car (θ̇ = v tan δ / L): it believes every steering angle is a turn it will get, at any speed.',
      show: () => mpc_() && isDyn()
    },
    {
      type: 'info',
      text: () =>
        `Input bounds come from Vehicle: |a| ≤ ${(P.accel ? P.amax : 3).toFixed(2)} m/s², ${isCar() ? `|δ̇| ≤ ${P.steerRate.toFixed(1)} rad/s` : `|α| ≤ ${(P.accel ? P.alpha : 8).toFixed(1)} rad/s²`}. ${P.accel ? '' : 'Acceleration limits are off, so the model assumes 3 m/s². '}${P.mpcLag && !(P.lag > 0) ? 'Lag τ is 0 in Vehicle, so the lag model is inactive.' : ''}`,
      show: mpc_
    }
  ],
  veh: [
    {
      k: 'veh',
      type: 'seg',
      label: 'Vehicle model',
      opts: [
        ['diff', 'Unicycle (diff-drive)'],
        ['car', 'Car (kinematic)'],
        ['dyn', 'Car (dynamic: tyre slip)']
      ]
    },
    {
      type: 'info',
      text: () =>
        'The car with tyre slip (dynamic bicycle model, chapter 1 §4): a tyre pushes sideways only by slipping, so the car turns less than its wheels point, and no more than the grip allows. Planners and trackers still assume the kinematic car, and so does the MPC unless Control → Tyre model in the prediction is ticked.',
      show: isDyn
    },
    {k: 'wheelbase', label: 'Wheelbase L', min: 0.3, max: 1.2, step: 0.05, unit: 'm', show: isCar},
    {k: 'steerMaxDeg', label: 'Max steering angle δ_max', min: 15, max: 45, step: 1, unit: '°', show: isCar},
    {
      type: 'info',
      text: () =>
        `Minimum turning radius L / tan δ_max = ${minTurnR().toFixed(2)} m · body ${carLen().toFixed(2)} × ${CAR.width.toFixed(2)} m`,
      show: isCar
    },
    {k: 'steerRate', label: 'Steering rate limit', min: 0.2, max: 4, step: 0.1, unit: 'rad/s', show: isCar},
    {
      type: 'btns',
      label: 'Tyres',
      items: () => [
        [
          'Grippy',
          () => dynPreset('grippy'),
          dynPresetOn('grippy'),
          'Realistic tyres: C_f 500, C_r 700 N/rad, μ 0.9; kinematic-like below 2 m/s'
        ],
        [
          'Slippery floor',
          () => dynPreset('slippery'),
          dynPresetOn('slippery'),
          'Soft tyres on a slippery floor: C_f 40, C_r 90 N/rad, μ 0.25; v_ch 2.6 m/s'
        ]
      ],
      show: isDyn
    },
    {k: 'mass', label: 'Mass m', min: 2, max: 40, step: 1, unit: 'kg', show: isDyn},
    {k: 'Iz', label: 'Yaw inertia I_z', min: 0.1, max: 5, step: 0.05, unit: 'kg·m²', show: isDyn},
    {
      k: 'lf',
      label: 'Front axle to centre of mass l_f',
      min: 0.05,
      max: () => +(P.wheelbase - 0.05).toFixed(2),
      step: 0.01,
      unit: 'm',
      show: isDyn
    },
    {k: 'Cf', label: 'Front cornering stiffness C_f', min: 10, max: 2000, step: 5, unit: 'N/rad', show: isDyn},
    {k: 'Cr', label: 'Rear cornering stiffness C_r', min: 10, max: 2000, step: 5, unit: 'N/rad', show: isDyn},
    {k: 'mu', label: 'Friction coefficient μ', min: 0.05, max: 1.5, step: 0.05, show: isDyn},
    {type: 'info', text: dynInfoText, show: isDyn},
    {
      k: 'vmax',
      label: 'Max speed v_max (reverse: half; car reverse ≤ 0.35)',
      min: 0.3,
      max: () => (isDyn() ? 4 : 2),
      step: 0.05,
      unit: 'm/s'
    },
    {k: 'wmax', label: 'Max turn rate ω_max', min: 0.3, max: 4, step: 0.1, unit: 'rad/s', show: () => !isCar()},
    {k: 'accel', type: 'bool', label: 'Acceleration limits'},
    {k: 'amax', label: 'Linear accel', min: 0.1, max: 3, step: 0.05, unit: 'm/s²', show: () => P.accel},
    {k: 'alpha', label: 'Angular accel', min: 0.2, max: 8, step: 0.1, unit: 'rad/s²', show: () => P.accel && !isCar()},
    {k: 'lag', label: 'Actuator lag τ', min: 0, max: 0.6, step: 0.01, unit: 's'},
    {k: 'latency', label: 'Control latency (whole ticks)', min: 0, max: 0.5, step: 0.05, unit: 's'},
    {k: 'sensLat', label: 'Sensor latency (lidar and beacons, whole ticks)', min: 0, max: 0.5, step: 0.05, unit: 's'},
    {
      k: 'people',
      type: 'seg',
      label: 'People',
      opts: [
        ['scripted', 'Scripted'],
        ['reactive', 'Reactive (social force)']
      ],
      show: () => LV.peds.length > 0
    },
    {k: 'vehicles', type: 'bool', label: 'Other vehicles drive the lanes', show: () => !!(LV.cars && LV.cars.length)},
    {k: 'biasDeg', label: 'Steering misalignment (bias)', min: -5, max: 5, step: 0.25, unit: '°', show: isCar},
    {k: 'biasW', label: 'Turn-rate bias (e.g. weak motor)', min: -0.3, max: 0.3, step: 0.01, unit: 'rad/s', show: () => !isCar()},
    {k: 'seed', label: 'Random seed (applies on Reset)', min: 1, max: 99, step: 1}
  ]
};
