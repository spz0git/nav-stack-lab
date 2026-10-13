/* ---------- glossary: short definitions of the terms the lessons use ---------- */
// Each entry: k key, n name shown in the pop-up, p regex source matched against lesson prose (whole words,
// case-insensitive unless cs), d definition, g lesson groups it applies to (all when absent; for words whose
// meaning depends on the subsystem). glossify() marks the first use of each term in a lesson body.
const GLOSS=[
 // localization
 {k:'dr',n:'Dead reckoning',p:'dead reckoning',d:'Estimating the pose by adding up the robot\'s own motion measurements from a known start, with no outside reference. Its error grows without limit.'},
 {k:'odo',n:'Odometry',p:'odometry',d:'The robot\'s measurement of its own motion: speed and turn rate from the wheel encoders. Noisy, and possibly biased.'},
 {k:'arc',n:'Arc model',p:'arc model',d:'Motion model that holds speed and turn rate constant over one tick, so the robot moves along a circular arc.'},
 {k:'pose',n:'Pose',p:'poses?',d:'Position and heading together: x, y and θ.'},
 {k:'tick',n:'Tick',p:'ticks?',d:'One simulation step, 50 ms (20 Hz). Sensors, estimators and controllers each run once per tick.'},
 {k:'cov',n:'Covariance',p:'covariances?',d:'Matrix describing how uncertain an estimate is and how its errors are correlated. Drawn as the ellipse around the estimated pose.'},
 {k:'2sig',n:'2σ band',p:'2σ band',cs:true,d:'Two standard deviations either side of the estimate. A consistent filter\'s true error stays inside it about 95 % of the time.'},
 {k:'consist',n:'Consistent filter',p:'consistent filter',d:'A filter whose covariance matches its actual errors: neither overconfident nor too cautious. NEES then averages about 3.'},
 {k:'est',n:'Estimator',p:'estimators?',d:'The part of the stack that turns noisy readings into a pose estimate: dead reckoning, EKF or particle filter.'},
 {k:'beacon',n:'Beacon',p:'beacons?',d:'A landmark at a known position. The robot measures its range and bearing.'},
 {k:'range',n:'Range',p:'range',g:['loc'],d:'Distance from the robot to a beacon or obstacle.'},
 {k:'bearing',n:'Bearing',p:'bearing',d:'Angle to a target, measured from the robot\'s heading.'},
 {k:'ekf',n:'EKF',p:'EKF',cs:true,d:'Extended Kalman filter: a Kalman filter for nonlinear models, linearized with Jacobians at the current estimate. It keeps a mean pose and its covariance.'},
 {k:'kgain',n:'Kalman gain',p:'Kalman gain',d:'How far an update moves the estimate toward a measurement. Large when the filter is unsure and the sensor is precise.'},
 {k:'kupd',n:'Kalman update',p:'Kalman update',d:'The correction step: compare a reading with its prediction and move the estimate by the Kalman gain times the difference.'},
 {k:'kf',n:'Kalman filter',p:'Kalman filters?',d:'Estimator for linear models with Gaussian noise. It predicts, then corrects with each measurement, weighted by the two uncertainties.'},
 {k:'innov',n:'Innovation',p:'innovations?',d:'Measurement minus prediction, ν = z − ẑ: the surprise that drives each update.'},
 {k:'mnoise',n:'Measurement noise',p:'measurement noise',d:'Random error in a sensor reading, modeled by its covariance Q.'},
 {k:'motnoise',n:'Motion noise',p:'motion noise',d:'The odometry noise the filter assumes when it predicts. Raising it makes the filter trust the beacons more.'},
 {k:'nees',n:'NEES',p:'NEES',cs:true,d:'Normalized estimation error squared, eᵀΣ⁻¹e: the true error measured in units of the filter\'s own uncertainty. About 3 for a consistent 3-state filter; higher means overconfident.'},
 {k:'overconf',n:'Overconfident',p:'overconfident',d:'Claiming less uncertainty (a smaller covariance) than the real error justifies.'},
 {k:'bias',n:'Bias',p:'bias',d:'A constant, systematic error that pushes every reading or command the same way. Unlike noise, it does not average out.'},
 {k:'unlab',n:'Unlabeled beacons',p:'unlabeled',d:'Beacons without IDs: the filter has to work out which beacon each reading came from (data association).'},
 {k:'maha',n:'Mahalanobis distance',p:'Mahalanobis distance',d:'Distance scaled by uncertainty: how many standard deviations apart two things are, allowing for correlations.'},
 {k:'gate',n:'Gate',p:'gat(?:e|es|ing)',d:'A threshold on the Mahalanobis distance. Readings outside it are rejected as outliers or wrong matches.'},
 {k:'clutter',n:'Clutter',p:'clutter',d:'False detections that do not come from any real landmark or object.'},
 {k:'kidnap',n:'Kidnapped robot',p:'kidnapp(?:ed robot|ing)',d:'The robot is teleported without being told. Tests whether the localizer notices it is lost and recovers.'},
 {k:'outlier',n:'Outlier',p:'outliers?',d:'A reading far from what is expected, usually treated as wrong and ignored.'},
 {k:'pf',n:'Particle filter',p:'particle filters?',d:'Represents the belief as many sampled poses (particles), weights each by how well it explains the readings, and resamples.'},
 {k:'resample',n:'Resampling',p:'resampl(?:e|es|ing)',d:'Drawing a new particle set in proportion to the weights: likely particles are copied, unlikely ones dropped.'},
 {k:'lvres',n:'Low-variance resampling',p:'low-variance resampling',d:'Resampling with one random offset and evenly spaced picks. It adds less randomness than independent draws.'},
 {k:'lik',n:'Likelihood',p:'likelihood',d:'How probable a reading is if a given pose were true. Used to weight particles.'},
 {k:'ess',n:'Effective sample size',p:'effective sample size',d:'N_eff = 1/Σwᵢ²: how many particles effectively carry weight. Low means a few particles dominate.'},
 {k:'inject',n:'Injection',p:'inject(?:ion|s)?',g:['loc','per'],d:'Adding random particles when the readings fit poorly, so the filter can recover from being wrong.'},
 {k:'gloc',n:'Global localization',p:'global localization',d:'Finding the pose with no initial guess at all.'},
 {k:'slam',n:'SLAM',p:'(?:EKF-)?SLAM',cs:true,d:'Simultaneous localization and mapping: estimating the pose and the map at the same time. EKF-SLAM puts the landmark positions into the EKF state.'},
 {k:'landmark',n:'Landmark',p:'landmarks?',d:'A distinct feature whose position is known or estimated; here a beacon.'},
 {k:'loopcl',n:'Loop closure',p:'loop closure',d:'Re-observing a place mapped earlier. It ties the current estimate back to that place and removes much of the accumulated drift.'},
 // perception
 {k:'lidar',n:'Lidar',p:'lidar',d:'A laser scanner that measures distance along many beams around the robot.'},
 {k:'logodds',n:'Log-odds',p:'log-odds',d:'log(p / (1 − p)): a probability rewritten so that independent pieces of evidence combine by addition.'},
 {k:'occ',n:'Occupancy',p:'occupancy',d:'Whether a grid cell is blocked by an obstacle. The map stores a probability for each cell.'},
 {k:'clamp',n:'Clamping',p:'clamp(?:ing|ed|s)?',d:'Limiting a value to a range; here it keeps every cell able to change again.'},
 {k:'costmap',n:'Costmap',p:'costmaps?',d:'Grid where each cell holds the cost of passing through it, derived from obstacles. The planner minimizes the total cost.'},
 {k:'lethal',n:'Lethal cell',p:'lethal',d:'A cell the robot cannot enter without collision. The planner never uses it.'},
 {k:'infl',n:'Inflation band',p:'inflation band',d:'The zone around lethal cells where cost fades with distance, so paths keep away from walls without being forbidden near them.'},
 {k:'dt',n:'Distance transform',p:'distance transform',d:'Computes, for every cell, the distance to the nearest occupied cell.'},
 {k:'frontier',n:'Frontier exploration',p:'frontier exploration',d:'Exploring by driving to the boundary between known free space and unknown space.'},
 {k:'tracker',n:'Tracker',p:'trackers?',g:['per','plan'],d:'Follows each person over time, keeping an estimate of their position and velocity.'},
 {k:'track',n:'Track',p:'tracks?',g:['per','plan'],d:'The tracker\'s estimate of one person over time: position, velocity and their uncertainty.'},
 {k:'cluster',n:'Cluster',p:'clusters?',d:'A group of nearby lidar hits treated as one object.'},
 {k:'cv',n:'Constant-velocity model',p:'constant-velocity',d:'Assumes an object keeps its current velocity; any acceleration is treated as noise.'},
 {k:'det',n:'Detection',p:'detections?',d:'One object found in one scan, before it is linked to a track.'},
 {k:'coast',n:'Coasting',p:'coast(?:s|ing)?',d:'Keeping a track alive on prediction alone while it gets no detections.'},
 {k:'occl',n:'Occluded',p:'occluded',d:'Hidden from the sensor behind something else.'},
 {k:'gt',n:'Ground truth',p:'ground truth',d:'The true state, known only in simulation. Used to measure errors.'},
 {k:'latency',n:'Latency',p:'latency',d:'Delay between something happening and the stack acting on it: sensing, transfer and processing.'},
 {k:'buffered',n:'Buffered filter',p:'(?:lagged-state|buffered) filter',d:'Keeps recent states and inputs so a late reading can be applied at the time it was taken.'},
 {k:'social',n:'Social forces',p:'social forces?',d:'A pedestrian model: a pull toward one\'s goal plus pushes away from people, robots and walls.'},
 {k:'agent',n:'Agent',p:'agents?',d:'A moving object other than the robot; here a person.'},
 // planning
 {k:'astar',n:'A*',p:'A\\*',cs:true,d:'Graph search that expands nodes in order of f = g + h, the cost so far plus an estimate of the cost to go. With an admissible h it finds the cheapest path.'},
 {k:'wastar',n:'Weighted A*',p:'Weighted A\\*',d:'A* with the heuristic multiplied by ε > 1: greedier and faster, with a path at most ε times the optimum.'},
 {k:'hastar',n:'Hybrid A*',p:'Hybrid A\\*',cs:true,d:'A* over grid cells, but each node holds a continuous pose and each edge is a short arc the car can drive, forward or in reverse.'},
 {k:'stastar',n:'Space-time A*',p:'Space-time A\\*',d:'A* over (x, y, t): waiting is a move, and a cell is blocked at the times a predicted agent covers it.'},
 {k:'heur',n:'Heuristic',p:'heuristics?',d:'An estimate of the remaining cost to the goal that steers the search.'},
 {k:'admiss',n:'Admissible',p:'admissible',d:'A heuristic that never overestimates the true remaining cost. A* is then guaranteed to find the optimal path.'},
 {k:'8conn',n:'8-connected grid',p:'8-connected',d:'Each cell connects to its eight neighbours, diagonals included.'},
 {k:'octile',n:'Octile distance',p:'octile distance',d:'Grid distance with diagonal moves: straight steps cost 1, diagonal steps √2.'},
 {k:'expand',n:'Expansion',p:'expan(?:sions?|ds?)',g:['plan'],d:'Taking a node off the search queue and generating its neighbours. The count measures search effort.'},
 {k:'rrt',n:'RRT*',p:'RRT\\*',cs:true,d:'Rapidly-exploring random tree, optimal variant: grows a tree from random samples and rewires it so the path keeps getting cheaper.'},
 {k:'rewire',n:'Rewiring',p:'rewir(?:e|es|ing)',d:'Reconnecting nearby tree nodes through a new node when that gives them a cheaper path.'},
 {k:'asopt',n:'Asymptotically optimal',p:'asymptotically optimal',d:'Converges to the optimal path as the number of samples grows without limit.'},
 {k:'seed',n:'Seed',p:'seed',d:'Starting value of the random-number generator: same seed, same samples, same path.'},
 {k:'turnrad',n:'Minimum turning radius',p:'minimum turning radius',d:'Radius of the tightest circle the car can drive, set by its wheelbase and steering limit.'},
 {k:'lock',n:'Full lock',p:'full-lock',d:'Steering at its limit.'},
 {k:'fsm',n:'State machine',p:'state machine',d:'A set of modes (plan, drive, wait…) and the rules for switching between them.'},
 {k:'replan',n:'Replanning',p:'replan(?:s|ning)?',d:'Computing a new path from the current pose when the old one is no longer valid.'},
 {k:'spdplan',n:'Speed planner',p:'speed planner',d:'Chooses the speed along the path over time, so the robot yields to predicted agents and respects its limits.'},
 {k:'horizon',n:'Prediction horizon',p:'prediction horizon',d:'How far ahead in time a prediction reaches.'},
 // control
 {k:'cruise',n:'Cruise speed',p:'cruise speed',d:'Target speed on straight stretches of the path.'},
 {k:'actuator',n:'Actuator',p:'actuators?',d:'What carries out a command: the drive motors and the steering.'},
 {k:'fol',n:'First-order lag',p:'first-order (?:lag|actuator)',d:'A response that approaches a new command exponentially, with time constant τ.'},
 {k:'plant',n:'Plant',p:'plant',d:'The system being controlled: here the vehicle with its actuators.'},
 {k:'bw',n:'Bandwidth',p:'bandwidth',d:'Roughly the highest frequency the loop follows well. Higher means a faster response.'},
 {k:'tc',n:'Time constant',p:'time constant',d:'Time a first-order system takes to cover 63 % of a step change.'},
 {k:'step',n:'Step test',p:'step tests?',d:'Apply a sudden change, such as a path offset or a bias, and record the response.'},
 {k:'mpc',n:'MPC',p:'MPC',cs:true,d:'Model predictive control: every tick it optimizes the next few seconds of inputs against a model, applies the first, and repeats.'},
 {k:'pm',n:'Phase margin',p:'phase margin',d:'Extra phase lag the loop tolerates at crossover before it goes unstable. About 45–65° is comfortable.'},
 {k:'gm',n:'Gain margin',p:'gain margin',d:'How much the loop gain can grow before the loop goes unstable.'},
 {k:'dm',n:'Delay margin',p:'delay margin',d:'Extra latency the loop tolerates before it goes unstable: phase margin divided by the crossover frequency.'},
 {k:'margin',n:'Stability margin',p:'margins?',g:['ctl'],d:'How far the loop is from instability: phase, gain or delay margin.'},
 {k:'cross',n:'Crossover',p:'crossover',d:'Frequency ω_c where the open-loop gain |L| is 1 (0 dB). It sets the speed of the loop.'},
 {k:'injsine',n:'Sine injection',p:'inject(?:ion|ed)',g:['ctl'],d:'Adding a small sine to the command and measuring the loop\'s response at that frequency.'},
 {k:'os',n:'Overshoot',p:'overshoot',d:'How far the response goes past its final value, as a percentage of the step.'},
 {k:'op',n:'Operating point',p:'operating point',d:'The steady condition the model is linearized about: speed, curvature and steering.'},
 {k:'fd',n:'Finite differences',p:'finite differences',d:'Estimating a derivative from the change in output for a small change in input.'},
 {k:'integ',n:'Integrator',p:'(?:double )?integrators?',d:'A block whose output is the running integral of its input, 1/s. Two in series make a double integrator.'},
 {k:'bode',n:'Bode plot',p:'Bode(?: plots?)?',d:'Loop gain in dB and phase, plotted against frequency.'},
 {k:'nyqf',n:'Nyquist frequency',p:'Nyquist frequency',d:'Half the sample rate. A sampled system cannot represent anything faster.'},
 {k:'nyq',n:'Nyquist plot',p:'Nyquist(?: plots?)?',d:'L(jω) drawn in the complex plane. The closed loop is unstable if the curve encircles −1 (with a stable open loop).'},
 {k:'ff',n:'Feedforward',p:'feedforward',d:'A command computed from the known path, here its curvature, rather than from the error.'},
 {k:'curv',n:'Curvature',p:'curvature',d:'1 / turning radius, positive to the left.'},
 {k:'lat',n:'Lateral error',p:'(?:lateral|cross-track) error',d:'Sideways distance from the robot to the path.'},
 {k:'deriv',n:'Derivative action',p:'derivative action',d:'Feedback on how fast the error changes. It adds damping.'},
 {k:'pd',n:'PD controller',p:'PD(?:-type| controller)',cs:true,d:'Proportional-derivative: the command depends on the error and its rate of change.'},
 {k:'pid',n:'PID',p:'PID',cs:true,d:'Proportional-integral-derivative: PD plus a term on the accumulated error.'},
 {k:'pp',n:'Pure pursuit',p:'pure pursuit',d:'Steers along the circular arc that reaches a point (the carrot) a lookahead distance ahead on the path.'},
 {k:'carrot',n:'Carrot',p:'carrot',d:'The target point a lookahead distance ahead on the path.'},
 {k:'look',n:'Lookahead',p:'lookahead',d:'How far ahead on the path the carrot is, L_d.'},
 {k:'lin',n:'Linearized',p:'lineari[sz]ed',d:'Replaced by a straight-line approximation that holds for small deviations.'},
 {k:'damp',n:'Damping',p:'damping',d:'How quickly oscillations die out. Damping ratio ζ = 1 is the fastest response without overshoot.'},
 {k:'rwf',n:'Rear-wheel feedback',p:'rear-wheel feedback',d:'Tracker that sets the turn rate from the path curvature plus heading and lateral error at the rear axle.'},
 {k:'stanley',n:'Stanley',p:'Stanley',cs:true,d:'Tracker that steers the front wheels by the heading error plus atan(k·e / v) of the front-axle cross-track error.'},
 {k:'db',n:'Decibel',p:'dB',cs:true,d:'20·log₁₀ of a gain: 0 dB is a gain of 1, +20 dB a gain of 10.'},
 {k:'cl',n:'Closed loop',p:'closed[- ]loop',d:'Controller and plant with the feedback connected.'},
 {k:'pole',n:'Pole',p:'poles?',g:['ctl'],d:'A root of the closed loop\'s characteristic equation. Its position sets how fast a mode decays and how much it oscillates.'},
 {k:'lc',n:'Limit cycle',p:'limit cycle',d:'A sustained oscillation of fixed amplitude, held in place by a nonlinearity such as a rate limit.'},
 {k:'settle',n:'Settling time',p:'settling time',d:'Time until the response stays within a small band (here 2 %) of its final value.'},
 {k:'msd',n:'Mass-spring-damper',p:'mass-spring-damper',d:'The textbook second-order system: a mass pulled back by a spring and slowed by a damper.'},
 {k:'rl',n:'Root locus',p:'root locus',d:'The paths the closed-loop poles trace as a gain is varied.'},
 {k:'rhp',n:'Right half plane',p:'right half plane',d:'Poles with a positive real part. They grow exponentially: the unstable region.'},
 {k:'sse',n:'Steady-state error',p:'steady-state error',d:'The error left once the response has settled.'},
 {k:'dist',n:'Disturbance',p:'disturbances?',d:'An unwanted input acting on the plant, such as an actuator bias.'},
 {k:'ia',n:'Integral action',p:'integral action',d:'Feedback on the accumulated error. It removes steady-state error, at a cost in phase.'},
 {k:'enc',n:'Encoder',p:'encoders?',d:'A sensor that measures wheel rotation or steering angle.'},
 {k:'sat',n:'Saturation',p:'saturat(?:es|ion|ed)',d:'A command beyond a limit is clipped, so the response stops scaling with the input.'},
 {k:'gs',n:'Gain scheduling',p:'gain scheduling',d:'Changing controller gains with the operating point; here with speed.'},
 {k:'hold',n:'Hold delay',p:'hold delay',d:'Each command is held for a whole tick, which acts like a delay of half a tick (25 ms).'},
 // symbols in prose, where the meaning is fixed by the lesson group
 {k:'sym-v',n:'v',p:'v',cs:true,g:['loc'],d:'Speed of the robot along its heading, m/s.'},
 {k:'sym-w',n:'ω',p:'ω',cs:true,g:['loc'],d:'Turn (yaw) rate, rad/s.'},
 {k:'sym-nu',n:'ν',p:'ν',cs:true,g:['loc'],d:'Innovation: measurement minus predicted measurement.'},
 {k:'sym-eps',n:'ε',p:'ε',cs:true,g:['plan'],d:'Heuristic weight of weighted A*: the path costs at most ε times the optimum.'},
 {k:'sym-zeta',n:'ζ',p:'ζ',cs:true,g:['ctl'],d:'Damping ratio of the dominant closed-loop poles: 1 is critically damped, lower overshoots.'},
 {k:'sym-tau',n:'τ',p:'τ',cs:true,g:['ctl'],d:'Time constant of the first-order actuator lag, s.'},
];
const GLOSS_BY=Object.fromEntries(GLOSS.map(e=>[e.k,e]));
// No lookbehind (older Safari cannot parse it): the character before a match is checked in glossify.
const GLOSS_RE=GLOSS.map(e=>({e,re:new RegExp(`(?:${e.p})(?![\\p{L}\\p{N}_])`,e.cs?'gu':'giu')})),GLOSS_WORD=/[\p{L}\p{N}_]/u;
const GLOSS_SKIP='.eq,summary,button,a,code,sub,sup,dfn,h1,h2,h3,input,textarea,select';
// Mark the first use of each glossary term in el's prose; group picks the entries whose meaning depends on the subsystem.
function glossify(el,group){
  if(!el)return;
  const used=new Set(),list=GLOSS_RE.filter(x=>!x.e.g||x.e.g.includes(group));
  const tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest(GLOSS_SKIP)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  const nodes=[];for(let n;(n=tw.nextNode());)nodes.push(n);
  for(let node of nodes){
    for(;;){
      const s=node.data;let best=null;
      for(const x of list){if(used.has(x.e.k))continue;x.re.lastIndex=0;
        for(let m;(m=x.re.exec(s));){
          if(m.index>0&&GLOSS_WORD.test(s[m.index-1])){x.re.lastIndex=m.index+1;continue;}
          // a symbol directly followed by a subscript is a different symbol (θ<sub>e</sub>, v<sub>0</sub>)
          if(x.e.k.startsWith('sym-')&&m.index+m[0].length===s.length&&node.nextSibling&&node.nextSibling.nodeName==='SUB')continue;
          if(!best||m.index<best.i||(m.index===best.i&&m[0].length>best.len))best={i:m.index,len:m[0].length,e:x.e};
          break;}}
      if(!best)break;
      used.add(best.e.k);
      const mid=node.splitText(best.i),rest=mid.splitText(best.len),d=document.createElement('dfn');
      d.className='term';d.tabIndex=0;d.dataset.g=best.e.k;d.textContent=mid.data;mid.replaceWith(d);node=rest;
    }
  }
}
// The pop-up: hover (mouse), focus (keyboard) or tap shows it; tap again, tap elsewhere or Esc hides it.
let termTip=null,termFor=null,termPinned=false;
function termShow(el,pin){
  const e=GLOSS_BY[el.dataset.g];if(!e)return;
  if(!termTip){termTip=document.createElement('div');termTip.id='termtip';termTip.className='termtip';termTip.setAttribute('role','tooltip');document.body.appendChild(termTip);}
  if(termFor&&termFor!==el)termFor.removeAttribute('aria-describedby');
  termTip.innerHTML=`<b>${e.n}</b>${e.d}`;termTip.hidden=false;termFor=el;termPinned=!!pin;el.setAttribute('aria-describedby','termtip');termPlace();
}
function termHide(){if(termFor)termFor.removeAttribute('aria-describedby');if(termTip)termTip.hidden=true;termFor=null;termPinned=false;}
function termPlace(){
  if(!termFor)return;const r=termFor.getBoundingClientRect(),w=termTip.offsetWidth,h=termTip.offsetHeight;
  let y=r.bottom+6;if(y+h>innerHeight-8&&r.top-h-6>8)y=r.top-h-6;
  termTip.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px';termTip.style.top=y+'px';
}
const termOf=t=>t&&t.closest?t.closest('dfn.term'):null;
document.addEventListener('pointerover',e=>{const d=termOf(e.target);if(d&&e.pointerType==='mouse'&&!termPinned)termShow(d);});
document.addEventListener('pointerout',e=>{const d=termOf(e.target);if(d&&e.pointerType==='mouse'&&!termPinned&&d===termFor&&!d.contains(e.relatedTarget)&&document.activeElement!==d)termHide();});
document.addEventListener('focusin',e=>{const d=termOf(e.target);if(d&&d!==termFor)termShow(d);});
document.addEventListener('focusout',e=>{const d=termOf(e.target);if(d&&d===termFor&&!termOf(e.relatedTarget))termHide();});
document.addEventListener('click',e=>{const d=termOf(e.target);
  if(d){if(d===termFor&&termPinned)termHide();else termShow(d,true);}
  else if(termFor&&!(termTip&&termTip.contains(e.target)))termHide();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&termFor){const d=termFor;termHide();d.blur();}});
document.addEventListener('scroll',termPlace,true);addEventListener('resize',termPlace);
