/* ============================================================
   UI: glossary. Technical terms in lessons, How-it-works notes and level hints become tap/hover pop-ups
   (first use per text block); each lesson lists the symbols its equations use.
   ============================================================ */
// [display name, pattern (regex source, case-insensitive unless the entry says cs), definition, scopes (optional)]
// Scopes: lesson groups and pipeline tabs (loc, per, plan, ctl, veh, mis); an entry without scopes applies everywhere.
const GLOSS=[
 // localization
 ['Dead reckoning','dead reckoning','Estimating the pose by integrating odometry alone, with no external correction. Its error and its uncertainty only grow.'],
 ['Odometry','odometry','The robot\'s own measurement of how it moved: speed v and turn rate ω from the wheels. Here it has random noise and a calibration bias.'],
 ['Arc model','arc model','Motion model that assumes v and ω are constant over one tick, so the robot moves along a circular arc (a straight line when ω = 0).'],
 ['Pose','poses?','Position and heading of the robot: x, y and θ.'],
 ['Tick','ticks?','One simulation step: 50 ms (20 Hz). Sensors and controllers run on whole ticks.'],
 ['Covariance','covariances?','Matrix that states the uncertainty of the estimate: variances on the diagonal, correlations off it. Drawn on the map as the 95 % ellipse.'],
 ['Covariance ellipse','ellipses?','The region that holds the true position with 95 % probability if the filter is right, drawn around the estimate.'],
 ['2σ band','2σ band','Two standard deviations of the filter\'s own uncertainty. A consistent filter\'s error stays inside it about 95 % of the time.'],
 ['Consistent filter','consistent','A filter whose stated uncertainty matches its actual errors: NEES close to the number of states (3 here).'],
 ['Overconfident','overconfident','The covariance is smaller than the real error, so the filter trusts itself too much and under-weights new readings.'],
 ['Beacon','beacons?','A landmark at a known position. The robot measures range and bearing to it, 5 times a second, when it is within range and in line of sight.'],
 ['Range and bearing','range and bearing','Distance to a beacon, and its direction relative to the robot\'s heading.'],
 ['EKF','EKF','Extended Kalman filter: a Kalman filter for nonlinear models, linearized about the current estimate at every step.'],
 ['Kalman gain','Kalman gain','How much of the innovation the filter applies to its estimate: large when the filter is unsure, small when the measurement is noisy.'],
 ['Innovation','innovations?','The difference between a reading and what the filter expected to read, ν = z − ẑ.'],
 ['NEES','NEES','Normalized estimation error squared, eᵀΣ⁻¹e: the true error measured in units of the filter\'s own uncertainty. About 3 for a consistent 3-state filter; higher means overconfident.'],
 ['Bias','bias','A constant, systematic error (a miscalibrated wheel, a misaligned steering link). Unlike noise it does not average out.',['loc','per','ctl','veh','']],
 ['Assumed motion noise','assumed motion noise','The odometry noise the filter believes in (Localize slider). It sets how fast the covariance grows between corrections.'],
 ['Unlabeled beacons','unlabeled(?: beacons)?','Beacon readings carry no ID, so the filter has to work out which beacon each reading came from (data association).'],
 ['Mahalanobis distance','Mahalanobis distance','Distance scaled by uncertainty, d² = νᵀS⁻¹ν: how many standard deviations a reading lies from what was expected.'],
 ['Gate','gat(?:e|ing)','A rejection test: a reading is used only if its Mahalanobis distance is below a threshold (d² < 9.21 here, 99 %).'],
 ['Clutter','clutter|false detections?','Beacon readings that come from no real beacon.'],
 ['Outlier','outliers?','A reading that does not fit the model and is rejected.'],
 ['Kidnapping','kidnap(?:ping|ped)?','Teleporting the robot without telling the estimator: a test of whether localization can recover.'],
 ['Particle filter','particle filter','Estimator that represents the belief by hundreds of sampled poses (particles), each weighted by how well it explains the readings.'],
 ['Resampling','resampl(?:ing|es?)','Redrawing the particle set in proportion to the weights, so likely poses multiply and unlikely ones die out.'],
 ['Effective sample size','effective sample size','N_eff = 1/Σw²: how many particles effectively carry weight. Low means a few particles dominate.'],
 ['Low-variance resampling','low-variance resampling','Resampling with one random number for the whole set (evenly spaced picks), which keeps particle diversity better than independent draws.'],
 ['Likelihood','likelihoods?','How probable a reading is, given a pose.'],
 ['Injection','inject(?:ion|s)?','Replacing some particles with poses drawn from the current beacon readings when the readings stop fitting. This is what recovers from kidnapping.',['loc','per']],
 ['Augmented MCL','augmented MCL','Monte Carlo localization that injects new particles when the short-term average likelihood drops below the long-term one.'],
 ['Global localization','global localization','Finding the pose with no initial guess, starting from particles spread over the whole map.'],
 ['SLAM','EKF-SLAM|SLAM','Simultaneous localization and mapping: estimating the map (here, the beacon positions) and the pose together.'],
 ['Landmark','landmarks?','A mapped feature the robot can observe again; in EKF-SLAM, a beacon whose position is estimated.'],
 ['Loop closure','loop closure','Re-observing a landmark mapped earlier, which pulls the accumulated drift back.'],
 ['Drift','drifts?','Slow growth of error from integrating noisy measurements.'],
 // perception
 ['Lidar','lidar','Laser range sensor: 120 beams all around the robot, 8 m range, 10 Hz.'],
 ['Log-odds','log-odds','log(p / (1 − p)) of a cell being occupied. Adding log-odds replaces multiplying probabilities; 0 means unknown.'],
 ['Occupancy grid','occupancy grid','The map as a grid of 0.1 m cells, each holding how likely it is to be occupied.'],
 ['Estimated frame','estimated frame','Coordinates as the robot believes them: readings placed using the pose estimate, not the truth.'],
 ['Costmap','costmap','Grid of traversal costs the planner searches: lethal cells near obstacles, a fading penalty in the inflation band, free elsewhere.'],
 ['Distance transform','distance transform','For every cell, the distance to the nearest occupied cell.'],
 ['Lethal','lethal','Cells closer to an obstacle than the robot\'s radius plus a margin (0.4 m). The planner never enters them.'],
 ['Inflation band','inflation band','Zone beyond the lethal cells where a penalty fades out, so paths keep off walls without being forbidden near them.'],
 ['Frontier exploration','frontier(?:-based)? exploration','Driving to the boundary between known free space and unknown space, to map a building systematically.'],
 ['Kalman filter','Kalman filter','Recursive estimator: predict with a motion model, then correct with each measurement, weighted by the relative uncertainties.'],
 ['Constant velocity','constant[- ]velocity','Prediction model that assumes each person keeps their current velocity.'],
 ['Track','tracks?','The tracker\'s estimate of one person: position, velocity and their uncertainty, with an ID.',['per']],
 ['Coast','coasts?','Keep predicting a track without detections for a short time (1 s here) while the person is hidden.'],
 ['Latency','latency','Delay between something happening and the stack acting on it (sensors), or between a command and its effect (actuators).'],
 ['Lagged-state filter','lagged-state|buffered filter','A filter that keeps recent past states, so a late reading can be applied at the time it was taken.'],
 ['Social forces','social forces?','Pedestrian model: a pull toward the goal, pushes away from other people, the robot and walls.'],
 // planning and the mission
 ['Hybrid A*','Hybrid A\\*','A* over continuous car poses: every edge is a short arc the car can drive, forward or in reverse.'],
 ['Space-time A*','Space-time A\\*','A* over (x, y, t): waiting is a move, and a cell is blocked at the times a predicted person covers it.'],
 ['Weighted A*','Weighted A\\*','A* with the heuristic multiplied by ε > 1: faster, and the path costs at most ε times the optimum.'],
 ['A*','A\\*','Graph search that expands the node with the lowest f = g + h. Optimal when the heuristic never overestimates.'],
 ['Heuristic','heuristics?','Estimate of the remaining cost to the goal, h, that guides the search.'],
 ['Admissible','admissible','A heuristic that never overestimates the true remaining cost. A* is then optimal.'],
 ['Octile distance','octile distance','Shortest distance on an 8-connected grid in free space: straight steps cost 1, diagonal steps √2.'],
 ['8-connected','8-connected','Each grid cell has 8 neighbours, diagonals included.'],
 ['Expansions','expansions?','Nodes the search took off its queue and examined: a measure of search effort.'],
 ['RRT*','RRT\\*','Rapidly-exploring random tree, optimal variant: grows a tree from random samples and rewires it toward shorter paths.'],
 ['Rewiring','rewir(?:ing|es?)','Reconnecting nearby nodes through a new node when that shortens their path.'],
 ['Asymptotically optimal','asymptotically optimal','Converges to the optimal path as the number of samples grows without bound.'],
 ['Turning radius','(?:minimum )?turning radius','The tightest circle the car can drive, L / tan δ_max (about 0.96 m here).'],
 ['Reeds–Shepp','Reeds[–-]Shepp','Shortest paths for a car that drives forward and in reverse: arcs at minimum radius and straights. Obstacles are ignored.'],
 ['Dijkstra','Dijkstra','Search that expands nodes in order of cost from the start: A* without a heuristic.'],
 ['Analytic expansion','analytic expansion','Trying a direct Reeds–Shepp path from a search node to the goal, and accepting it if it is collision-free.'],
 ['Steering limit','steering limit','Maximum front-wheel angle, δ_max (32° by default).'],
 ['State machine','state machine','The mission logic: states (IDLE, PLAN, DRIVE, NO_PATH, LOST, DONE) and the events that switch between them.'],
 ['Replan','replan(?:s|ning|ned)?','Run the planner again from the current pose because an assumption behind the old path broke.'],
 ['Speed planner','speed planner','Picks a speed profile along the fixed path so that predicted people are not hit (the ST graph).'],
 ['Prediction horizon','prediction horizon','How far ahead in time people\'s motion is predicted and planned against.'],
 // control loop
 ['Path tracker','(?:path )?trackers?','Controller that steers the robot along the planned path: pure pursuit, rear-wheel feedback, Stanley, PID, DWA or MPC.',['ctl']],
 ['Integrator','integrators?','An element whose output is the time integral of its input. The steering loop has two in series: steering → heading error → lateral error.'],
 ['Lateral error','lateral error|cross-track error|cross-track','Sideways distance from the robot to the path, e.'],
 ['Heading error','heading error','Angle between the robot\'s heading and the direction of the path, θe.'],
 ['Derivative action','derivative action','Feedback on the rate of change of the error. It damps the response.'],
 ['Finite differences','finite differences','Estimating a derivative by nudging an input slightly and measuring the change in the output.'],
 ['Hold delay','hold delay|zero-order hold','The command is held for a whole 50 ms tick, which acts like an extra delay of half a tick (25 ms).'],
 ['Actuator lag','actuator lag','The actuator follows its command with a first-order lag of time constant τ.'],
 ['Pure pursuit','pure pursuit','Tracker that steers along the circle through a point one lookahead distance ahead on the path.'],
 ['Lookahead','lookahead|carrot','The point on the path a distance L_d ahead of the robot that pure pursuit steers toward.'],
 ['Curvature','curvature','1 / turning radius: how tightly a path bends.'],
 ['PD controller','PD(?:-type)?(?: controller| loop)?','Proportional-derivative controller: feedback on the error and on its rate of change.'],
 ['PID','PID','Proportional-integral-derivative controller: feedback on the error, its integral and its rate of change.'],
 ['Operating point','operating point','The steady condition the analysis linearizes about: here a straight path at constant speed with zero error.'],
 ['Bode plot','Bode(?: plot)?','A frequency response drawn as gain in dB and phase against frequency on a log scale.'],
 ['dB','dB','Decibels: 20·log₁₀ of a gain. 0 dB is a gain of 1.'],
 ['Crossover','crossover','The frequency ω_c where the loop gain |L| equals 1 (0 dB); roughly the closed-loop bandwidth.'],
 ['Phase margin','phase margin','How much extra phase lag the loop tolerates at crossover before it becomes unstable (PM).'],
 ['Gain margin','gain margin','How much the loop gain can be multiplied by before the loop becomes unstable (GM).'],
 ['Closed loop','closed[- ]loop','The system with the feedback connected.'],
 ['Damping','damping(?: ratio)?','How quickly oscillations die out. ζ = 1 is critically damped; a small ζ rings.'],
 ['Nyquist frequency','Nyquist frequency','Half the sampling rate (π/T = 62.8 rad/s for the 20 Hz loop). A sampled loop cannot represent faster signals.'],
 ['Nyquist criterion','Nyquist criterion|Nyquist plot','Stability test: count how often L(jω) circles the −1 point.'],
 ['Encirclement','encirclements?','One full turn of the Nyquist curve around −1; clockwise ones count unstable closed-loop poles.'],
 ['Pole','poles?','A root of the characteristic equation. Its position sets how a mode decays (left half plane) or grows (right half plane).'],
 ['Delay margin','delay margin','Extra delay the loop tolerates before it becomes unstable, PM / ω_c.'],
 ['Limit cycle','limit cycle','A sustained oscillation of fixed amplitude, here set by the turn-rate or steering-rate limit.'],
 ['Overshoot','overshoot','How far the response passes its target before settling, in percent.'],
 ['Settling time','settling time','Time until the response stays within 2 % of its final value.'],
 ['Root locus','root locus','The paths the closed-loop poles follow as the controller gain is scaled.'],
 ['Right half plane','right half plane','Poles with a positive real part: those modes grow, so the loop is unstable.'],
 ['Rear-wheel feedback','rear-wheel feedback','Tracker that commands curvature from the heading and lateral errors at the rear axle, plus the path\'s curvature.'],
 ['First-order lag','first-order(?: lag| actuator)?','A response that approaches its command exponentially: 63 % of a step in one time constant τ.'],
 ['Time constant','time constant','τ: the time a first-order response takes to reach 63 % of a step.'],
 ['MPC','MPC','Model predictive control: every tick, optimize the inputs over a horizon using a model of the vehicle, apply the first move, repeat.'],
 ['Integral action','integral action','Feedback on the accumulated error, which removes constant offsets.'],
 ['Steady-state error','steady-state error|standing error','Error that remains once the response has settled.'],
 ['Saturation','saturat(?:es?|ion|ing)','An actuator at its limit: its output stops following the command.'],
 ['Rate limit','rate limit','Maximum rate of change of an actuator (steering 1.5 rad/s by default).'],
 ['Gain scheduling','gain scheduling','Changing controller gains with the operating condition, here with speed.'],
 ['Stanley','Stanley','Tracker that steers the front wheels from the heading error and the front axle\'s cross-track error.'],
 ['Feedforward','feedforward','A command computed from what is known in advance (the path\'s curvature) rather than from the error.'],
 ['Injection (sine)','injection|injected sine','Adding a sine at the plant input in the simulator and measuring what comes back around the loop, to measure L(jω).',['ctl']],
];
// Symbols each lesson uses, keyed by group:index (0-based). Shown under the lesson text.
const SUB=s=>`<sub>${s}</sub>`;
const LESSON_SYMS={
 'loc:0':[['μ','Pose estimate (mean), [x, y, θ]'],['Σ, Σ′','Covariance of the estimate, before and after one step'],[`${I('u')} = (${I('v')}, ω)`,'Odometry input: speed and turn rate'],[`${I('g')}(μ, ${I('u')})`,'Motion model: the arc over one tick'],[`${I('G')}, ${I('V')}`,`How a pose error and an odometry error carry through ${I('g')} (Jacobians)`],[I('M'),`Odometry noise covariance, diag(σ${SUB('v')}², σ${SUB('ω')}²)`],[`σ${SUB('x')}`,'Standard deviation of the x error'],['θ','Heading; here the heading error'],[I('t'),'Time since the start']],
 'loc:1':[[I('z'),'Beacon reading [range, bearing]'],[I('ẑ'),'Reading the filter expects from its estimate'],['ν','Innovation, z − ẑ'],[I('H'),'How the expected reading changes with the pose (Jacobian)'],[I('Q'),'Measurement noise covariance'],[I('S'),'Innovation covariance, HΣHᵀ + Q'],[I('K'),'Kalman gain'],['μ, Σ','Estimate and its covariance'],[I('I'),'Identity matrix'],[I('e'),'True pose error, truth − estimate'],['ᵀ, ⁻¹','Transpose, inverse']],
 'loc:2':[[`${I('d')}²`,'Squared Mahalanobis distance of a reading'],['ν, S','Innovation and its covariance'],['χ²','Chi-squared distribution; 9.21 is its 99 % point with 2 degrees of freedom']],
 'loc:3':[[I('N'),'Number of particles'],[`${I('w')}${SUB('i')}`,`Normalized weight of particle ${I('i')}`],[`${I('N')}${SUB('eff')}`,'Effective sample size'],[I('w'),'Average likelihood of the current reading'],[`${I('w')}${SUB('fast')}, ${I('w')}${SUB('slow')}`,'Short- and long-term averages of w']],
 'loc:4':[[I('x'),'SLAM state: the pose, then every mapped landmark'],[`${I('m')}${SUB('i')}`,`Estimated position of landmark ${I('i')}`],[I('P'),'Covariance of the whole state; P_xx is the pose block, P_mm a new landmark\'s block'],[I('n'),'Number of mapped landmarks'],[I('p'),'Robot position'],[`${I('r')}, ${I('b')}`,'Range and bearing of the reading'],[`${I('J')}${SUB('x')}, ${I('J')}${SUB('z')}`,'How the new landmark\'s position depends on the pose and on the reading'],[I('R'),'Measurement noise covariance']],
 'per:0':[[I('l'),'Log-odds that a cell is occupied'],[`${I('l')}${SUB('meas')}`,'Increment from one beam'],[`${I('l')}${SUB('free')}, ${I('l')}${SUB('hit')}`,'Increment for a cell the beam passes through / ends in']],
 'per:1':[[I('d'),'Distance from the cell to the nearest occupied cell'],[I('w'),'Width of the inflation band (Perceive slider)']],
 'per:2':[[I('x'),`Track state: position p${SUB('x')}, p${SUB('y')} and velocity v${SUB('x')}, v${SUB('y')}`],[I('F'),'Constant-velocity transition: position += velocity · Δt'],[I('Q'),'Process noise covariance'],[`σ${SUB('a')}`,'White acceleration noise of the model'],[`${I('d')}²`,'Squared Mahalanobis distance of a detection'],[`${I('p')}(${I('t')}), ${I('r')}(${I('t')})`,`Predicted position and radius ${I('t')} seconds ahead`],[I('g'),'Growth rate of the predicted radius']],
 'per:3':[[I('t'),'Time the reading was taken'],[`${I('T')}${SUB('s')}`,'Sensor latency'],['ν','Innovation'],[I('v'),'Robot speed']],
 'per:4':[[I('F'),'Social force on a person'],[`${I('v')}₀, ${I('e')}`,'Desired speed, and unit vector toward the goal'],[I('v'),'Current velocity'],['τ','Relaxation time'],[`${I('A')}, ${I('B')}`,'Strength and range of the push'],[`${I('r')}${SUB('i')} + ${I('r')}${SUB('j')}, ${I('d')}`,'Sum of the two radii, and the distance between centres'],[I('n'),'Unit vector away from the other body']],
 'plan:0':[[I('f'),'Search priority'],[I('g'),'Cost from the start'],[I('h'),'Heuristic: estimated cost to the goal'],['ε','Heuristic weight']],
 'plan:1':[[I('r'),'Rewiring radius'],[I('n'),'Number of nodes in the tree']],
 'plan:2':[[I('h'),'Heuristic'],['ε','Heuristic weight']],
 'plan:4':[[`(${I('i')}, ${I('j')}, ${I('k')})`,'Cell column, row and time step'],[`Δ${I('t')}`,'Time step: one cell at the reference speed'],[`${I('v')}₀`,'Reference speed'],[`${I('c')}${SUB('ij')}`,'Centre of cell (i, j)'],[`${I('p')}${SUB('a')}(${I('t')}), ${I('r')}${SUB('a')}(${I('t')})`,`Predicted position and radius of agent ${I('a')} at time ${I('t')}`]],
 'ctl:0':[[`θ${SUB('e')}`,'Heading error'],[I('e'),'Lateral error'],[I('u'),'Steering command: ω (diff-drive) or δ (car)'],[I('g'),'Plant gain from u to heading rate'],[`${I('v')}₀`,'Speed at the operating point'],[I('L'),'Wheelbase'],['ẋ','A dot means rate of change (time derivative)']],
 'ctl:1':[[`${I('L')}${SUB('d')}`,'Lookahead distance'],['α','Bearing from the heading to the carrot'],[`${I('e')}, θ${SUB('e')}`,'Lateral and heading error'],[`${I('L')}(${I('s')})`,'Loop transfer function'],[I('s'),'Laplace variable (s = jω on the frequency axis)'],[`${I('T')}${SUB('d')}`,'Total delay in the loop'],[`ω${SUB('c')}`,'Crossover frequency'],[`${I('v')}₀, ${I('L')}`,'Speed, wheelbase']],
 'ctl:2':[[`|${I('L')}(${I('j')}ω)|`,'Loop gain at frequency ω'],['ω','Frequency, rad/s'],[`${I('K')}${SUB('e')}, ${I('K')}${SUB('θ')}`,'Controller gains on e and θe'],[`ω${SUB('c')}`,'Crossover frequency'],['PM','Phase margin'],['ζ','Damping ratio'],[`|${I('T')}|, |${I('S')}|`,'Path following and disturbance amplification (complementary sensitivity, sensitivity)'],[`${I('M')}${SUB('s')}`,'Peak of |S|'],[I('T'),'In π/T: sample time, 0.05 s']],
 'ctl:3':[[`${I('L')}(${I('s')})`,'Loop transfer function'],[I('N'),'Clockwise encirclements of −1'],[I('P'),'Unstable open-loop poles'],[I('Z'),'Unstable closed-loop poles, N + P'],[`${I('M')}${SUB('s')}`,'Peak of |S|; 1/M_s is the closest approach to −1'],[`${I('T')}${SUB('d')}`,'Delay'],[I('j'),'Imaginary unit']],
 'ctl:4':[['DM','Delay margin'],['PM','Phase margin, in radians here'],[`ω${SUB('c')}`,'Crossover frequency'],[`Δ${I('T')}`,'Extra delay']],
 'ctl:5':[[I('z'),'Discrete-time pole of the 20 Hz loop'],[I('s'),'The same pole in continuous time, ln z / T'],[I('T'),'Sample time, 0.05 s'],['ζ','Damping ratio'],[`ω${SUB('n')}`,'Natural frequency'],[`${I('t')}${SUB('s')}`,'Settling time to 2 %'],[`${I('k')}${SUB('θ')}, ${I('k')}${SUB('e')}`,'Rear-wheel feedback heading and lateral gains'],[`${I('v')}₀`,'Speed']],
 'ctl:6':[['τ','Actuator time constant'],['ω','Frequency'],[`${I('M')}${SUB('s')}`,'Peak of |S|'],[`${I('K')}${SUB('c')}`,'MPC gain on its own previous command']],
 'ctl:7':[[`${I('e')}${SUB('ss')}`,'Steady-state lateral error'],[I('d'),'Constant actuator bias'],[`${I('K')}${SUB('e')}`,'Command per metre of lateral error'],[`${I('K')}${SUB('i')}`,'PID integral gain']],
 'ctl:9':[[`${I('v')}₀`,'Speed'],[I('L'),'Wheelbase'],['δ','Steering angle'],[`θ${SUB('e')}`,'Heading error'],[`${I('L')}${SUB('d')} = ${I('L')}₀ + ${I('k')}·${I('v')}₀`,'Pure-pursuit lookahead: offset plus speed gain'],[`ω${SUB('c')}`,'Crossover frequency']],
 'ctl:10':[[`${I('G')}(${I('s')})`,'Speed response of the actuator chain'],[`${I('T')}${SUB('lat')}`,'Control latency'],['τ','Actuator time constant'],[I('a'),'Acceleration command'],[`${I('v')}, ${I('v')}${SUB('ref')}, ${I('v')}${SUB('cmd')}`,'Measured, reference and commanded speed'],[`${I('K')}${SUB('v')}, ${I('K')}${SUB('vc')}, ${I('K')}${SUB('u')}`,'MPC gains on speed error, command error and its previous acceleration']],
 'ctl:11':[[`${I('e')}${SUB('est')}`,'Lateral error as the estimator sees it'],[I('e'),'True lateral error'],[I('u'),'Steering command'],[`${I('L')}(${I('j')}ω)`,'Loop frequency response']],
 'ctl:12':[[`θ${SUB('e')}, ${I('e')}`,'Heading and lateral error'],[`${I('u')}, ${I('u')}₀`,'Steering command, and its value at the settled point on the circle'],[`${I('g')}, ${I('v')}₀`,'Plant gain, speed']],
};
function lessonSymsHTML(id){const S=LESSON_SYMS[id];if(!S)return'';
  return`<div class="lsyms"><h4>Symbols</h4><dl>${S.map(([s,d])=>`<dt>${s}</dt><dd>${d}</dd>`).join('')}</dl></div>`;}

// Wrap the first use of each glossary term in a text block. Skips equations, buttons, links and headings.
const GLOSS_RX=GLOSS.map(([n,p,d,sc],i)=>({i,n,d,sc,rx:new RegExp(`(?<![\\p{L}\\p{N}_-])(?:${p})(?![\\p{L}\\p{N}_])`,'iu')}));
const GLOSS_SKIP='.eq,button,a,summary,h1,h2,h3,h4,.term,.lsyms,code,pre,sub,sup,.tries,.lbl';
function glossify(root,scope){
  if(!root)return;const used=new Set(),list=GLOSS_RX.filter(g=>!g.sc||g.sc.includes(scope));
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest(GLOSS_SKIP)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  const nodes=[];while(w.nextNode())nodes.push(w.currentNode);
  for(let node of nodes){
    for(;;){let best=null;const t=node.nodeValue;
      for(const g of list){if(used.has(g.i))continue;const m=g.rx.exec(t);if(m&&(!best||m.index<best.m.index||(m.index===best.m.index&&m[0].length>best.m[0].length)))best={g,m};}
      if(!best)break;used.add(best.g.i);
      const mid=node.splitText(best.m.index),rest=mid.splitText(best.m[0].length),b=document.createElement('button');
      b.type='button';b.className='term';b.dataset.g=best.g.i;b.textContent=mid.nodeValue;mid.replaceWith(b);node=rest;
    }
  }
}
// One pop-up for every term: hover or focus shows it, a tap or click pins it, Escape or a tap elsewhere closes it.
const termTip=(()=>{const t=document.createElement('div');t.className='termtip';t.id='termtip';t.setAttribute('role','tooltip');t.hidden=true;document.body.appendChild(t);return t;})();
let termCur=null,termPinned=false;
function termShow(b,pin){
  const g=GLOSS[+b.dataset.g];if(!g)return;
  if(termCur&&termCur!==b)termCur.removeAttribute('aria-describedby');
  termCur=b;termPinned=!!pin;b.setAttribute('aria-describedby','termtip');
  termTip.innerHTML=`<b>${g[0]}</b> ${g[2]}`;termTip.hidden=false;
  const r=b.getBoundingClientRect(),vw=document.documentElement.clientWidth,vh=window.innerHeight,tw=termTip.offsetWidth,th=termTip.offsetHeight;
  termTip.style.left=Math.max(8,Math.min(r.left,vw-tw-8))+'px';
  termTip.style.top=(r.bottom+6+th<=vh-8||r.top-6-th<8?r.bottom+6:r.top-6-th)+'px';
}
function termHide(){if(termCur)termCur.removeAttribute('aria-describedby');termCur=null;termPinned=false;termTip.hidden=true;}
document.addEventListener('pointerover',e=>{const b=e.target.closest&&e.target.closest('.term');if(b&&e.pointerType==='mouse'&&!termPinned)termShow(b,false);});
document.addEventListener('pointerout',e=>{const b=e.target.closest&&e.target.closest('.term');if(b&&b===termCur&&!termPinned&&e.pointerType==='mouse')termHide();});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.term');
  if(b){e.preventDefault();e.stopPropagation();if(b===termCur&&termPinned)termHide();else termShow(b,true);return;}
  if(termPinned&&!termTip.contains(e.target))termHide();},true);
document.addEventListener('focusin',e=>{const b=e.target.closest&&e.target.closest('.term');if(b&&!termPinned)termShow(b,false);});
document.addEventListener('focusout',e=>{if(termCur&&e.target===termCur&&!termPinned)termHide();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&termCur){const b=termCur;termHide();b.focus();}});
window.addEventListener('scroll',()=>{if(termCur)termHide();},true);
window.addEventListener('resize',()=>{if(termCur)termHide();});
