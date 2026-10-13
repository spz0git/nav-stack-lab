/* ============================================================
   UI: glossary — short definitions that pop up over terms in the lessons
   ============================================================ */
// [term, pattern, definition, options]. The pattern is a regular-expression source matched as a whole word, case-insensitive
// unless opts.cs; opts.in limits the entry to lesson groups (loc, per, plan, ctl) where the word means something else elsewhere.
// Longer phrases come before the words they contain, so "particle filter" wins over "particle".
const GLOSSARY=[
 // localization
 ['dead reckoning','dead reckoning','Estimating the pose by adding up odometry alone, with no outside corrections. The error grows without bound.'],
 ['odometry','(wheel )?odometry','Speed and turn rate (v, ω) measured from the wheels. Here it has noise, and a calibration bias the filters are not told about.'],
 ['pose','poses?','Where the robot is and which way it faces: position (x, y) and heading θ.'],
 ['arc model','arc model','The motion model used here: v and ω are held constant over one 50 ms tick, so the robot moves along a circular arc (a straight line when ω = 0).'],
 ['motion model','motion model','g(μ, u): predicts the next pose from the current pose and the odometry input.'],
 ['covariance ellipse','(covariance )?ellipses?','The region where the filter claims the true position lies with 95 % probability, drawn around the estimate. Its size and shape come from the covariance.'],
 ['covariance','covariances?','How uncertain the estimate is, as a matrix: the diagonal holds the variances (σ²) of x, y and θ, the rest how their errors move together.'],
 ['2σ band','2σ band','Two standard deviations either side, as claimed by the filter. A consistent filter keeps its true error inside it about 95 % of the time.'],
 ['consistent filter','consistent( filter)?|consistency','A filter whose covariance matches its actual errors: neither overconfident (errors larger than it claims) nor overcautious.'],
 ['truth','(ground )?truth|true pose','The simulator\'s actual pose, which the robot never sees. Only the plots and metrics use it.'],
 ['Position error plot','Position error( plot)?','Telemetry channel: distance between the true and the estimated position, with the band the filter claims (2σ).'],
 ['estimate','estimates?|estimated','The filter\'s best guess of the pose (its mean μ), as opposed to the true pose.'],
 ['noise','noise|noisy','Random error with zero average, added to a measurement or to the motion. Filters model it with a covariance.'],
 ['bias','bias(es)?','A constant error, such as miscalibrated wheels or a misaligned steering link. It does not average out, and a filter that models only noise cannot remove it.'],
 ['EKF','EKF','Extended Kalman filter: keeps the estimate as a mean μ and covariance Σ, and pushes them through linearized motion and measurement models.',{cs:true}],
 ['Kalman gain','(Kalman )?gain','How far an update moves the estimate toward a measurement: far when the filter is unsure and the sensor precise, little otherwise.',{in:['loc']}],
 ['innovation','innovations?','The difference between a reading and what the filter predicted it would read, ν = z − ẑ.'],
 ['beacon','beacons?','A landmark at a known position that the robot measures with range and bearing. Unlabeled beacons do not say which one they are.'],
 ['NEES','NEES','Normalized estimation error squared, eᵀΣ⁻¹e: the true error measured in units of the filter\'s own uncertainty. About 3 (one per state) when the filter is consistent.',{cs:true}],
 ['overconfident','overconfident','Claiming less uncertainty than the actual error. The filter then gives too little weight to measurements that would correct it.'],
 ['Mahalanobis distance','Mahalanobis distance','Distance counted in standard deviations of the predicted uncertainty, so a 1 m miss counts as small when the uncertainty is large.'],
 ['gate','gat(e|es|ing)','A test that rejects a reading whose Mahalanobis distance is too large to be plausible: here d² > 9.21, the 99 % point.'],
 ['χ²','χ²','The chi-squared distribution: what a squared Mahalanobis distance follows when the model is right. Its percentiles set the gate.'],
 ['kidnapped robot','kidnapp(ed|ing)( robot)?|kidnap','Teleporting the robot without telling the estimator: the test of whether a localizer can recover from being completely wrong.'],
 ['outlier','outliers?','A reading far from what the model predicts, usually a wrong match or a false detection.'],
 ['particle filter','particle filter','Represents the belief as many sampled poses (particles), each weighted by how well it explains the readings.'],
 ['particle','particles?','One hypothesis of the robot pose in a particle filter.'],
 ['likelihood','likelihoods?','How probable a reading is if a given pose were true. It becomes the particle\'s weight.'],
 ['low-variance resampling','low-variance resampling','Resampling with one random number and evenly spaced pointers, so particles are not lost by chance.'],
 ['resampling','resampl(e|es|ing)','Drawing a new particle set in proportion to the weights: likely poses get copies, unlikely ones disappear.'],
 ['effective sample size','effective sample size','N_eff = 1 / Σ w_i²: how many particles effectively carry the weight. Small when a few dominate.'],
 ['injection','injection|inject(s|ed)?','Adding new random particles when the readings stop fitting, so the filter can find a pose it has lost.',{in:['loc','per']}],
 ['augmented MCL','augmented MCL','Monte Carlo localization (a particle filter) that compares short- and long-term average likelihoods and injects particles when the short-term one drops.'],
 ['global localization','global localization','Finding the pose with no initial guess.'],
 ['SLAM','EKF-SLAM|SLAM','Simultaneous localization and mapping: estimating the pose and the map together. EKF-SLAM puts the landmark positions into the EKF state.',{cs:true}],
 ['landmark','landmarks?','A feature whose position is in the map, here a beacon.'],
 ['correlated','correlated','Errors that move together. A landmark placed from an uncertain pose shares that pose\'s error.'],
 ['loop closure','loop closure','Re-observing a landmark mapped earlier, which pulls the accumulated drift back.'],
 // perception
 ['lidar','lidar','A scanning range sensor. Here: 120 beams over 360°, 8 m range, 10 scans per second.'],
 ['log-odds','log-odds','log(p / (1 − p)): a probability rewritten so that independent evidence adds instead of multiplies. 0 means 50 %, unknown.'],
 ['occupancy grid','(occupancy )?grid','A map of 0.1 m cells, each holding how likely it is to be occupied.',{in:['per']}],
 ['clamp','clamp(ing|ed)?','Limiting a value to a range; here ±4 log-odds, so a cell can still change its mind.'],
 ['costmap','costmaps?','The grid of traversal costs the planner searches: lethal cells are forbidden, cells near obstacles cost extra.'],
 ['distance transform','distance transform','Gives every grid cell its distance to the nearest occupied cell.'],
 ['lethal','lethal','A cell the robot\'s center may not enter, because its body would then touch an obstacle.'],
 ['inflation band','inflation( band)?','The band beyond the lethal cells where an extra cost fades out, pushing paths away from walls.'],
 ['frontier exploration','frontier exploration','Driving to the boundary between known free space and unknown space, to map more.'],
 ['constant velocity','constant-velocity|constant velocity','A motion model that predicts an agent keeps its current velocity.'],
 ['track','tracks?|tracker','An agent the tracker estimates over time (position and velocity), built from matched detections.',{in:['per']}],
 ['cluster','clusters?','A group of nearby lidar hits treated as one object.'],
 ['coast','coast(s|ing)?','Keeping a track alive by prediction alone while it is not detected, here for up to 1 s.'],
 ['occluded','occlu(ded|sion)','Hidden from the sensor behind something else.'],
 ['latency','latency|latencies','Delay between something happening (or a reading being taken) and it being used. Added here in whole 50 ms ticks.'],
 ['lagged-state filter','lagged-state( or buffered)? filter','A filter that keeps its recent past states, so a late reading can be applied at the time it was taken.'],
 ['social forces','social forces?','A pedestrian model: each person is pulled toward their goal and pushed away from the robot, other people and walls.'],
 // planning
 ['weighted A*','weighted A\\*','A* with f = g + ε·h and ε > 1: far fewer expansions, path cost at most ε times the optimum.',{cs:true}],
 ['space-time A*','space-time A\\*','A* over (x, y, t): waiting is a move, and a cell is blocked at the times a predicted agent covers it.',{cs:true}],
 ['Hybrid A*','Hybrid A\\*','A* whose nodes carry a continuous pose and whose edges are short arcs the car can drive, so the path respects its turning radius.',{cs:true}],
 ['A*','A\\*','Graph search that always expands the node with the smallest f = g + h: cost so far plus estimated cost to go.',{cs:true}],
 ['heuristic','heuristics?','h: an estimate of the remaining cost to the goal, used to steer the search.'],
 ['admissible','admissible','A heuristic that never overestimates the true remaining cost. A* with one returns an optimal path.'],
 ['octile distance','octile distance','Shortest distance on an 8-connected grid with no obstacles: diagonal steps cost √2 cells.'],
 ['8-connected','8-connected','Each grid cell connects to its 8 neighbours, diagonals included.'],
 ['expansions','expansions?|expands?','Nodes the search took off its open list and examined: the measure of search effort.'],
 ['RRT*','RRT\\*','Rapidly-exploring random tree, optimizing: grows a tree from random samples and rewires it toward shorter paths.',{cs:true}],
 ['rewiring','rewir(e|es|ing)','Reconnecting nearby nodes through a new node when that makes their path cheaper.'],
 ['asymptotically optimal','asymptotically optimal','Converges to the optimal path as the number of samples grows without limit.'],
 ['seed','seed','The starting number of the random generator; the same seed gives the same run.'],
 ['turning radius','(minimum )?turning radius','The smallest circle the car can drive: wheelbase / tan(steering limit).'],
 ['Dijkstra','Dijkstra','Search by cost so far only (A* with h = 0). Here it gives the obstacle-aware 2D heuristic.'],
 ['Reeds–Shepp','Reeds–Shepp','The shortest path for a car that drives forward and in reverse with a minimum turning radius, ignoring obstacles: arcs and straight pieces.'],
 ['analytic expansion','analytic expansion','Trying to finish the search with an exact Reeds–Shepp path to the goal, accepted if it is collision-free.'],
 ['full lock','full-lock|full lock','Steering at its limit.'],
 ['state machine','state machine','The mission logic: a set of states (PLAN, DRIVE, …) and the events that move between them.'],
 ['replan','replan(s|ning)?','Computing a new path because the current one\'s assumptions broke.'],
 ['speed planner','speed planner','Chooses the speed along a fixed path so the robot stays clear of where agents are predicted to be (the ST graph).'],
 // control
 ['tracker','(path )?trackers?','A controller that steers the robot along a path: pure pursuit, rear-wheel feedback, Stanley, PID or MPC.',{in:['ctl','plan']}],
 ['operating point','operating point','The steady condition a model is linearized about; here a straight path at speed v₀.'],
 ['linearized','lineari[sz](ed|ation|e)','Approximated by a linear (first-order) model about an operating point. Valid while errors stay small.'],
 ['integrator','integrators?','An element whose output is the running sum of its input, 1/s in the Laplace domain.'],
 ['derivative action','derivative action','Feedback on the rate of change of the error. It adds damping.'],
 ['finite differences','finite differences','Estimating a derivative by evaluating a function at two nearby inputs.'],
 ['actuator lag','actuator lag|first-order actuator','The actuator approaches its command gradually, 1/(τs + 1), instead of at once.'],
 ['transfer function','transfer function','The input–output relation of a linear system, written in the Laplace variable s, such as L(s).'],
 ['open loop','open[- ]loop','The loop cut open at one point: L(s) is what a signal goes through once around the loop.'],
 ['closed loop','closed[- ]loop','The loop with feedback connected: the controller acts on the error its own action changes.'],
 ['Bode plot','Bode( plot)?','Gain in dB and phase of L(jω) plotted against frequency.'],
 ['crossover','(gain )?crossover','The frequency ω_c where |L| = 1 (0 dB); roughly the closed-loop bandwidth.'],
 ['phase margin','phase margin','How far the phase at crossover is above −180°: the loop\'s room for extra delay or lag.'],
 ['gain margin','gain margin','How much the loop gain could grow before the loop goes unstable.'],
 ['delay margin','delay margin','Extra latency the loop tolerates before instability, PM / ω_c.'],
 ['Nyquist frequency','Nyquist frequency','Half the sampling rate, π/T: the highest frequency a sampled loop can represent.'],
 ['Nyquist criterion','Nyquist( criterion| plot)?','L(jω) drawn in the complex plane. Clockwise encirclements of −1 count the unstable closed-loop poles.'],
 ['sensitivity','sensitivity|\\|S\\|','S = 1 / (1 + L): how much disturbances reach the error. Its peak M_s is 1 over the closest approach of L to −1.'],
 ['dB','dB','Decibels: 20 log₁₀ of a gain. 0 dB is a gain of 1, −20 dB a tenth.',{cs:true}],
 ['bandwidth','bandwidth','The frequency up to which a loop follows its input well.'],
 ['pole','poles?','A root of the closed-loop characteristic equation. Its place in the s-plane sets how fast a response mode decays and how it oscillates.'],
 ['damping','damping|damped','How quickly oscillation dies out. Damping ratio ζ: 0 never stops ringing, 1 just stops without overshoot.'],
 ['root locus','root locus','The paths of the closed-loop poles as the controller\'s gain is scaled up and down.'],
 ['overshoot','overshoots?','How far the response passes its target before settling, in % of the step.'],
 ['limit cycle','limit cycle','A sustained oscillation of fixed size, set by a saturation rather than by the linear dynamics.'],
 ['saturation','saturat(e|es|ion)|rate limit','An actuator that cannot go beyond a limit (angle, rate, acceleration). The loop is then no longer linear.'],
 ['MPC','MPC','Model predictive control: every tick, optimize the next seconds of input against a model of the vehicle, apply the first move, repeat.',{cs:true}],
 ['steady-state error','steady-state error|standing error','Error that remains after the response has settled.'],
 ['integral action','integral action','Feedback on the accumulated error. It removes the error a constant disturbance leaves, at the cost of phase.'],
 ['disturbance','disturbances?','An unwanted input acting on the loop, such as an actuator bias.'],
 ['gain scheduling','gain scheduling|schedules itself','Changing a controller\'s gains with the operating point, here with speed.'],
 ['pure pursuit','pure pursuit','Steers along the arc that reaches a carrot point a lookahead distance ahead on the path.'],
 ['lookahead','lookahead','Distance ahead along the path to the carrot point pure pursuit aims at.'],
 ['carrot','carrot','The point on the path, a lookahead distance ahead, that pure pursuit steers toward.'],
 ['rear-wheel feedback','rear-wheel feedback','A tracker that feeds back lateral and heading error and uses the path curvature as feedforward.'],
 ['feedforward','feedforward','Acting on what is known in advance (here the path\'s curvature) rather than on the error.'],
 ['Stanley','Stanley','A tracker that steers the front wheels to cancel the heading error plus a term for the front axle\'s cross-track error.',{cs:true}],
 ['PID','PID|PD','Proportional, integral and derivative feedback on the error. PD leaves out the integral.',{cs:true}],
 ['sine injection','inject(ed|ion)( sine)?','Measuring L(jω) in the simulator: a small sine is added at the plant input, and what returns through the controller is compared with what went in.',{in:['ctl']}],
 ['hold','sample-and-hold|hold delay|zero-order hold','Each command is held constant over the 50 ms tick, which acts like a delay of half a tick.'],
];

// Wrap the first use of each glossary term in a lesson's prose (not in equations, buttons or sub/superscripts)
const GLOSS_SKIP=/^(BUTTON|SUB|SUP|A|CODE)$/;
const glossRe=GLOSSARY.map(([,pat,,o])=>new RegExp(`(^|[^\\p{L}\\p{N}_])(${pat})(?=$|[^\\p{L}\\p{N}_])`,o&&o.cs?'u':'iu'));
function glossify(body,group){
  const used=new Set();
  GLOSSARY.forEach(([term,,,o],gi)=>{
    if(used.has(term)||(o&&o.in&&!o.in.includes(group)))return;
    const tw=document.createTreeWalker(body,NodeFilter.SHOW_TEXT,{acceptNode:n=>{
      for(let e=n.parentNode;e&&e!==body;e=e.parentNode)if(GLOSS_SKIP.test(e.tagName)||e.classList.contains('eq')||e.classList.contains('term')||e.classList.contains('lsym'))return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;}});
    for(let n=tw.nextNode();n;n=tw.nextNode()){
      const m=glossRe[gi].exec(n.data);if(!m)continue;
      const at=m.index+m[1].length,w=n.splitText(at);w.splitText(m[2].length);
      const s=document.createElement('span');s.className='term';s.tabIndex=0;s.dataset.g=gi;s.setAttribute('role','button');s.setAttribute('aria-expanded','false');
      w.parentNode.replaceChild(s,w);s.appendChild(w);used.add(term);break;
    }
  });
}
// Symbol key under a lesson's equations: [symbol, meaning] pairs from the lesson's sy list
function symKey(sy){
  if(!sy||!sy.length)return'';
  return`<div class="lsym"><h4>Symbols</h4><dl>${sy.map(([s,d])=>`<dt>${s}</dt><dd>${d}</dd>`).join('')}</dl></div>`;
}

// One shared pop-up: hover or focus shows it, a tap or click pins it, Escape or a tap elsewhere closes it
let glossPop=null,glossAt=null,glossPinned=false;
function glossShow(el,pin){
  if(!glossPop){glossPop=document.createElement('div');glossPop.className='gloss-pop';glossPop.id='gloss-pop';glossPop.setAttribute('role','tooltip');document.body.appendChild(glossPop);}
  if(glossAt&&glossAt!==el)glossAt.setAttribute('aria-expanded','false');
  const[term,,def]=GLOSSARY[+el.dataset.g];
  glossPop.innerHTML=`<b>${term}</b> ${def}`;glossPop.hidden=false;glossAt=el;glossPinned=!!pin;
  el.setAttribute('aria-expanded','true');el.setAttribute('aria-describedby','gloss-pop');
  const r=el.getBoundingClientRect(),vw=document.documentElement.clientWidth,pw=Math.min(300,vw-32);
  glossPop.style.width=pw+'px';
  const left=clamp(r.left+r.width/2-pw/2,16,vw-16-pw),ph=glossPop.offsetHeight;
  const top=r.bottom+6+ph<=window.innerHeight-8||r.top-6-ph<8?r.bottom+6:r.top-6-ph;
  glossPop.style.left=left+'px';glossPop.style.top=top+'px';
}
function glossHide(){if(!glossPop||glossPop.hidden)return;glossPop.hidden=true;glossPinned=false;if(glossAt){glossAt.setAttribute('aria-expanded','false');glossAt.removeAttribute('aria-describedby');}glossAt=null;}
function glossWire(root){
  root.querySelectorAll('.term').forEach(t=>{
    t.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&!glossPinned)glossShow(t,false);});
    t.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!glossPinned&&glossAt===t)glossHide();});
    t.addEventListener('focus',()=>{if(!glossPinned)glossShow(t,false);});
    t.addEventListener('blur',()=>{if(!glossPinned&&glossAt===t)glossHide();});
    t.addEventListener('click',e=>{e.stopPropagation();if(glossAt===t&&glossPinned)glossHide();else glossShow(t,true);});
    t.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(glossAt===t&&glossPinned)glossHide();else glossShow(t,true);}});
  });
}
document.addEventListener('click',e=>{if(glossAt&&!(glossPop&&glossPop.contains(e.target)))glossHide();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')glossHide();});
window.addEventListener('scroll',glossHide,{passive:true,capture:true});
window.addEventListener('resize',glossHide);
