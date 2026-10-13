/* ============================================================
   Glossary: short definitions on hover, tap or focus for the symbols and terms in the lessons and
   How-it-works notes, plus a "Terms in this lesson" list. Symbols come from NOMEN (the Symbols tab),
   looked up in the subsystems that fit the context, so g in a localization lesson is the motion model
   and g in a loop-analysis lesson is the plant gain. Terms are the words the lessons lean on.
   ============================================================ */
// context → NOMEN groups searched, in order
const GL_CTX={loc:['loc','veh','tele'],per:['per','ag','loc','veh'],mis:['mis','plan','loc','veh'],plan:['plan','mis','ag','per','veh'],
  ctl:['ctl','mpc','ag','veh'],an:['an','ctl','mpc','veh'],veh:['veh','loc','ag','ctl']};
// lesson id (0-based) → groups, where a lesson needs its own scope; titles of the groups that exist only here
const GL_LESSON={'per:4':['sf','per','ag','loc','veh'],'ctl:10':['spd','an','ctl','mpc','veh']};
const GL_TITLES={sf:'Social force',spd:'Speed loop'};
const glCtxFor=id=>GL_LESSON[id]||(id.split(':')[0]==='ctl'?'an':id.split(':')[0]);
const glGroups=ctx=>Array.isArray(ctx)?ctx:(GL_CTX[ctx]||[ctx]);
const Ig=s=>`<i>${s}</i>`;
// symbols the lessons and notes use that NOMEN does not list under a usable key: [group, keys, symbol HTML, definition, unit]
const GL_SYM_EXTRA=[
 ['veh',['t'],Ig('t'),'Time','s'],
 ['veh',['I'],Ig('I'),'Identity matrix',''],
 ['veh',['π'],'π','Pi, 3.14159…',''],
 ['veh',['L_wb'],`${Ig('L')}<sub>wb</sub>`,'Wheelbase','m'],
 ['loc',['g'],Ig('g'),`Motion model: the next pose from the current pose μ and the odometry input ${Ig('u')}`,''],
 ['loc',['z'],Ig('z'),'Beacon measurement: range and bearing','m, rad'],
 ['loc',['r'],Ig('r'),'Measured range to a beacon','m'],
 ['loc',['b'],Ig('b'),'Measured bearing to a beacon, in the body frame','rad'],
 ['loc',['Δx','Δy'],'Δ<i>x</i>, Δ<i>y</i>','Beacon position minus robot position','m'],
 ['loc',['σ_x','σ_y'],'σ<sub>x</sub>, σ<sub>y</sub>','Standard deviation of the position estimate along x and y; σ² is its variance','m'],
 ['loc',['χ','χ_2'],'χ²','Chi-square distribution. The gate uses its 99 % point for 2 degrees of freedom, 9.21',''],
 ['loc',['w'],Ig('w'),'Average likelihood of the current beacon readings over all particles',''],
 ['loc',['w_fast','w_slow'],`${Ig('w')}<sub>fast</sub>, ${Ig('w')}<sub>slow</sub>`,'Short- and long-term averages of that likelihood. When the short-term average drops below the long-term one, the filter injects new particles',''],
 ['loc',['m'],Ig('m'),'Position of a landmark (beacon) in the SLAM state','m'],
 ['loc',['m_1x','m_1y'],`${Ig('m')}<sub>1x</sub>, ${Ig('m')}<sub>1y</sub>`,'Position of the first mapped landmark','m'],
 ['loc',['n'],Ig('n'),'Number of landmarks mapped so far',''],
 ['loc',['p'],Ig('p'),'Robot position [x, y]','m'],
 ['loc',['P'],Ig('P'),'Covariance of the whole SLAM state, pose and landmarks: (3 + 2n) × (3 + 2n)',''],
 ['loc',['P_xx','P_mm'],`${Ig('P')}<sub>xx</sub>, ${Ig('P')}<sub>mm</sub>`,'Blocks of P: pose–pose and landmark–landmark covariance',''],
 ['loc',['J_x','J_z'],`${Ig('J')}<sub>x</sub>, ${Ig('J')}<sub>z</sub>`,'Jacobians of a new landmark\'s position with respect to the robot pose and to the reading',''],
 ['loc',['R'],Ig('R'),'Measurement noise covariance of a beacon reading (Q in the EKF notation)',''],
 ['per',['l_meas'],`${Ig('l')}<sub>meas</sub>`,`Log-odds increment of one reading: ${Ig('l')}<sub>hit</sub> at the beam end, ${Ig('l')}<sub>free</sub> along the beam`,''],
 ['per',['w'],Ig('w'),'Width of the inflation band beyond the lethal radius','m'],
 ['per',['I'],Ig('I'),'Identity matrix',''],
 ['ag',['p','p_x','p_y'],`${Ig('p')} = [${Ig('p')}<sub>x</sub>, ${Ig('p')}<sub>y</sub>]`,`Agent position; predicted ${Ig('p')}(${Ig('t')}) = ${Ig('p')} + ${Ig('v')}·${Ig('t')}`,'m'],
 ['ag',['v','v_x','v_y'],`${Ig('v')} = [${Ig('v')}<sub>x</sub>, ${Ig('v')}<sub>y</sub>]`,'Agent velocity estimated by the tracker','m/s'],
 ['ag',['p̂'],Ig('p̂'),'Track position predicted to the time of the scan','m'],
 ['ag',['z'],Ig('z'),'Detected agent position: the center of a lidar cluster','m'],
 ['ag',['P_pp'],`${Ig('P')}<sub>pp</sub>`,'Position variance of a track','m²'],
 ['ag',['χ','χ_2'],'χ²₂','Chi-square distribution with 2 degrees of freedom; its 99 % point 9.21 is the gate',''],
 ['sf',['v_0'],`${Ig('v')}<sub>0</sub>`,'Speed a person wants to walk at (social force)','m/s'],
 ['sf',['e'],Ig('e'),'Unit vector toward the person\'s goal (social force)',''],
 ['sf',['r_i','r_j'],`${Ig('r')}<sub>i</sub>, ${Ig('r')}<sub>j</sub>`,'Radii of the two bodies in a repulsion term','m'],
 ['sf',['n'],Ig('n'),'Unit vector pointing away from the other body',''],
 ['sf',['F'],Ig('F'),'Force on a person: goal attraction plus repulsion from the robot, people and walls',''],
 ['sf',['A','B'],`${Ig('A')}, ${Ig('B')}`,'Strength and range of the repulsion between two bodies','—, m'],
 ['sf',['Σ'],'Σ','Sum over the other people, the robot and the walls',''],
 ['sf',['d'],Ig('d'),'Distance between the centers of the two bodies','m'],
 ['sf',['v'],Ig('v'),'The person\'s current velocity','m/s'],
 ['spd',['a'],Ig('a'),'Acceleration the MPC commands: its rate input on speed','m/s²'],
 ['veh',['ℯ'],Ig('e'),'Euler\'s number, 2.718…: the base of the exponential',''],
 ['sf',['τ'],'τ','Relaxation time: how fast a person returns to the velocity they want','s'],
 ['ag',['r'],Ig('r'),`Agent radius; the predicted radius grows with time, ${Ig('r')}(${Ig('t')}) = ${Ig('r')} + ${Ig('g')}·${Ig('t')}`,'m'],
 ['ag',['v_ref'],`${Ig('v')}<sub>ref</sub>`,'Speed the tracker would use at this point of the path: cruise, curvature and stopping limits','m/s'],
 ['plan',['f'],Ig('f'),'Search priority of a node, g + ε·h','m'],
 ['plan',['g'],Ig('g'),'Cost-to-come of a search node','m'],
 ['plan',['h'],Ig('h'),'Heuristic estimate of the cost-to-go','m'],
 ['plan',['i','j'],`${Ig('i')}, ${Ig('j')}`,'Grid cell indices',''],
 ['plan',['k'],Ig('k'),'Time index of space-time A*: t = k·Δt',''],
 ['plan',['c_ij'],`${Ig('c')}<sub>ij</sub>`,'Center of cell (i, j)','m'],
 ['plan',['p_a','r_a'],`${Ig('p')}<sub>a</sub>, ${Ig('r')}<sub>a</sub>`,'Predicted position and radius of agent a','m'],
 ['plan',['r_robot'],`${Ig('r')}<sub>robot</sub>`,'Robot radius, 0.3 m','m'],
 ['plan',['v_0'],`${Ig('v')}<sub>0</sub>`,'Reference speed the plan assumes','m/s'],
 ['mis',['NO_PATH'],'NO_PATH','Mission state: the planner found no path. It retries after 2 s and skips the goal after 3 failures in a row',''],
 ['ctl',['d_goal'],`${Ig('d')}<sub>goal</sub>`,'Distance left to the end of the leg','m'],
 ['ctl',['v_top'],`${Ig('v')}<sub>top</sub>`,'Highest speed DWA considers this tick','m/s'],
 ['ctl',['κ_cmd'],'κ<sub>cmd</sub>','Curvature the controller commands','1/m'],
 ['ctl',['θ_path'],'θ<sub>path</sub>','Heading of the path tangent','rad'],
 ['ctl',['e_left'],`${Ig('e')}<sub>left</sub>`,'Stanley: lateral offset of the front axle, positive to the left of the path','m'],
 ['ctl',['v_ref'],`${Ig('v')}<sub>ref</sub>`,'Speed of the reference profile at this point','m/s'],
 ['mpc',['v_cmd','s_cmd'],`${Ig('v')}<sub>cmd</sub>, ${Ig('s')}<sub>cmd</sub>`,'Commanded speed and turn state, as the MPC models a lagging actuator','m/s, rad'],
 ['mpc',['u'],'<b>u</b>',`MPC input [${Ig('a')}, ${Ig('ṡ')}]`,''],
 ['mpc',['θ_mid'],'θ<sub>mid</sub>','Heading at the middle of a prediction step','rad'],
 ['mpc',['w_k','w_Np'],`${Ig('w')}<sub>k</sub>`,'Weight of step k: 1, or the terminal multiplier on the last step',''],
 ['mpc',['e_θ','e_v'],`${Ig('e')}<sub>θ</sub>, ${Ig('e')}<sub>v</sub>`,'Heading error and speed error against the reference','rad, m/s'],
 ['mpc',['Σ'],'Σ','Sum over the steps of the horizon',''],
 ['an',['u'],Ig('u'),'Steering command of the loop: ω for the diff-drive, δ for the car','rad/s or rad'],
 ['an',['u_0'],`${Ig('u')}<sub>0</sub>`,'Steering command at the operating point (nonzero on a curve)','rad/s or rad'],
 ['an',['s'],Ig('s'),'Laplace variable (complex frequency); s = jω on the frequency axis','1/s'],
 ['an',['j'],Ig('j'),'Imaginary unit, √−1',''],
 ['an',['t_s'],`${Ig('t')}<sub>s</sub>`,'Settling time to within 2 %','s'],
 ['an',['d'],Ig('d'),'Constant actuator bias: a step disturbance at the plant input','rad/s or rad'],
 ['an',['e_est'],`${Ig('e')}<sub>est</sub>`,'Lateral error as the estimator sees it','m'],
 ['an',['e_ss'],`${Ig('e')}<sub>ss</sub>`,'Steady-state lateral error','m'],
 ['an',['G'],Ig('G'),'Speed plant: commanded to actual speed, through latency and lag',''],
 ['an',['T_lat'],`${Ig('T')}<sub>lat</sub>`,'Control latency','s'],
 ['an',['K_v','K_vc'],`${Ig('K')}<sub>v</sub>, ${Ig('K')}<sub>vc</sub>`,'MPC speed-loop gains: acceleration per m/s of speed error and of commanded-speed error','1/s'],
 ['an',['a_prev'],`${Ig('a')}<sub>prev</sub>`,'The MPC\'s previous acceleration move','m/s²'],
 ['an',['v_ref','v_cmd'],`${Ig('v')}<sub>ref</sub>, ${Ig('v')}<sub>cmd</sub>`,'Reference speed and commanded speed','m/s'],
 ['an',['ζ'],'ζ','Damping ratio of the dominant closed-loop pole pair',''],
 ['an',['ω_n'],'ω<sub>n</sub>','Natural frequency of the dominant closed-loop pole pair','rad/s'],
];
// terms: [keys, definition]; matched in prose, case-insensitive, plural allowed, once per body
const GL_WORDS=[
 [['odometry'],'Speed and turn rate measured by the wheels. Noisy and slightly biased here.'],
 [['dead reckoning'],'Integrating odometry alone, with nothing to correct it. The error only grows.'],
 [['arc model'],'Motion model that moves the pose along a circular arc for one tick at constant v and ω.'],
 [['pose'],'Position and heading together: [x, y, θ].'],
 [['tick'],'One step of the simulation: 50 ms (20 Hz).'],
 [['covariance'],'How uncertain an estimate is, and how its errors are correlated. Drawn as the ellipse around the estimate.'],
 [['consistent filter','consistent'],'A filter whose covariance matches its real errors: NEES averages about 3 for the 3-state pose.'],
 [['band'],'The 2σ band in the error plot: twice the standard deviation the filter claims.'],
 [['EKF','extended Kalman filter'],'Extended Kalman filter: a Kalman filter on the linearized model, here correcting the pose with beacon readings.'],
 [['Kalman gain'],'How far the estimate moves toward a measurement. Large when the filter is unsure, small when it is confident.'],
 [['innovation'],'Measurement minus what the filter expected to measure, ν = z − ẑ.'],
 [['NEES'],'Normalized estimation error squared, eᵀΣ⁻¹e: the true error measured in units of the claimed uncertainty. About 3 when consistent.'],
 [['overconfident'],'The covariance claims less uncertainty than the real error: NEES well above 3.'],
 [['bias'],'A constant error, as opposed to noise that averages out. The filters model noise, not bias.'],
 [['beacon'],'A landmark at a known position that gives range and bearing when in line of sight.'],
 [['Mahalanobis distance'],'Distance measured in standard deviations of the expected spread, d² = νᵀS⁻¹ν.'],
 [['gate','gating'],'Rejecting readings whose Mahalanobis distance is too large to be plausible.'],
 [['clutter','false detections'],'Readings that come from nothing: here, fake beacon detections.'],
 [['kidnapping','kidnapped robot','kidnap'],'The robot is moved without the estimator being told: the classic test of recovery.'],
 [['particle filter'],'Represents the belief by many sampled poses (particles) weighted by how well they explain the readings.'],
 [['particle'],'One hypothesis of the pose in a particle filter.'],
 [['resampling','resample'],'Drawing a new particle set in proportion to the weights, so effort goes to likely poses.'],
 [['effective sample size'],'How many particles really carry weight, N_eff = 1 / Σ w_i².'],
 [['injection','inject'],'Adding fresh particles drawn from the current readings, so the filter can recover when it is lost.'],
 [['augmented MCL'],'Monte Carlo localization that injects random particles when the readings fit worse than usual.'],
 [['global localization'],'Finding the pose with no prior: start from particles spread over the whole map.'],
 [['likelihood'],'How probable the readings are if the robot were at a given pose.'],
 [['EKF-SLAM','SLAM'],'Simultaneous localization and mapping: estimate the pose and the landmark positions together.'],
 [['landmark'],'A feature the robot can recognize and measure, here a beacon.'],
 [['loop closure'],'Re-observing a landmark mapped long ago, which pulls the accumulated drift back.'],
 [['lidar'],'Laser range finder: 120 beams over 360°, 8 m range, 10 Hz.'],
 [['log-odds'],'log(p / (1 − p)). Evidence adds instead of multiplying, and 0 means unknown.'],
 [['occupancy grid','grid'],'The map as 0.1 m cells, each holding the evidence that it is occupied.'],
 [['costmap'],'The grid the planner reads: lethal cells plus a penalty that fades with distance from obstacles.'],
 [['distance transform'],'Distance from every cell to the nearest occupied cell.'],
 [['lethal'],'Cells the robot center may not enter: too close to an obstacle for the robot\'s radius.'],
 [['inflation band'],'Soft cost zone beyond the lethal cells that keeps paths away from walls when that is cheap.'],
 [['frontier exploration','frontier'],'Exploring by driving to the boundary between known free space and unknown space.'],
 [['track'],'The tracker\'s running estimate of one moving agent: position, velocity and uncertainty.'],
 [['constant-velocity','constant velocity'],'Prediction that assumes an agent keeps its current velocity.'],
 [['social force','social forces'],'Model of people walking: pulled toward a goal, pushed away from obstacles and others.'],
 [['latency'],'Delay between producing a reading or command and it taking effect.'],
 [['A*'],'Best-first graph search on f = g + h. Optimal when h never overestimates.'],
 [['heuristic'],'Estimate of the remaining cost to the goal that guides the search.'],
 [['admissible'],'A heuristic that never overestimates the true cost; A* then returns an optimal path.'],
 [['octile distance','octile'],'Shortest path length on an 8-connected grid with no obstacles.'],
 [['weighted A*'],'A* with the heuristic scaled by ε > 1: faster, cost at most ε × optimal.'],
 [['expansions','expansion'],'Nodes the search took off the queue and explored; a measure of effort.'],
 [['RRT*'],'Rapidly-exploring random tree with rewiring: a sampling planner that improves toward optimal as samples grow.'],
 [['rewiring','rewires'],'Reconnecting nearby nodes through a new node when that makes their path cheaper.'],
 [['Hybrid A*'],'A* over continuous car poses: every edge is a drivable arc, forward or reverse.'],
 [['Reeds–Shepp','Reeds-Shepp'],'Shortest path for a car that can drive forward and in reverse with a minimum turning radius, ignoring obstacles.'],
 [['analytic expansion'],'In Hybrid A*: try to finish with a Reeds–Shepp curve straight to the goal.'],
 [['cusp'],'Where a car path changes gear between forward and reverse.'],
 [['space-time A*'],'A* over (x, y, t): waiting is a move, and cells are blocked when a predicted agent covers them.'],
 [['replan','replanning'],'Computing a new global path when the old one is no longer valid.'],
 [['behaviour layer','behavior layer','state machine'],'The mission logic: plan, drive, replan, skip a goal, finish.'],
 [['crossover'],'Frequency where the loop gain |L| is 1 (0 dB); roughly the closed-loop bandwidth.'],
 [['phase margin'],'How far the phase is above −180° at crossover. More margin, less ringing.'],
 [['gain margin'],'How much the loop gain can grow before the loop goes unstable.'],
 [['delay margin'],'Extra delay the loop tolerates before instability: phase margin / crossover frequency.'],
 [['Bode plot','Bode'],'Loop gain and phase against frequency, on log axes.'],
 [['Nyquist'],'Plot of L(jω) in the complex plane. Encirclements of −1 count unstable closed-loop poles.'],
 [['sensitivity'],'S = 1/(1+L): how much the loop amplifies disturbances. Its peak is M_s.'],
 [['root locus'],'Paths of the closed-loop poles as the controller gain is scaled.'],
 [['pole','poles'],'Roots of the closed-loop characteristic equation; they set how responses decay or oscillate.'],
 [['damping'],'How quickly oscillations die out, measured by ζ.'],
 [['overshoot'],'How far the response passes its final value, in percent.'],
 [['settling time','settling'],'Time until the response stays within 2 % of its final value.'],
 [['zero-order hold','hold delay'],'A sampled command held constant for one tick; it acts like half a tick of delay.'],
 [['actuator lag'],'The actuator follows its command with a first-order delay, time constant τ.'],
 [['integral action','integrator'],'Feedback on the accumulated error, which removes steady error under a constant bias.'],
 [['rate limit','steering-rate limit'],'Limit on how fast the steering angle or turn rate can change.'],
 [['saturation','saturates'],'An actuator at its limit: the response stops scaling with the command.'],
 [['limit cycle'],'A sustained oscillation of fixed size, typical of an unstable loop with saturation.'],
 [['gain scheduling'],'Changing the controller gains with the operating condition, here with speed.'],
 [['operating point'],'The steady condition the loop is linearized about: speed, path curvature.'],
 [['double integrator','two integrators'],'Steering command → heading → lateral position: two integrations in series.'],
 [['pure pursuit'],'Path tracker that steers toward a carrot point a lookahead distance ahead.'],
 [['lookahead'],'Distance ahead on the path of the point pure pursuit aims at.'],
 [['rear-wheel feedback'],'Tracker that feeds path curvature forward and corrects heading and lateral error.'],
 [['Stanley'],'Tracker that corrects the front axle\'s cross-track and heading error.'],
 [['PID'],'Proportional, integral and derivative feedback on an error.'],
 [['MPC','model predictive control'],'Model predictive control: optimize the next inputs over a horizon every tick, apply the first.'],
 [['feedforward'],'Command computed from the plan itself (here the path curvature), not from the error.'],
 [['bandwidth'],'Frequency up to which the system follows its input well.'],
 [['linear model','linearized','linearization'],'The small-signal approximation of the loop about the operating point.'],
 [['estimator'],'The localization filter that produces the pose the controller uses.'],
];
const GL_MODS=/[ᵀ'′²³⁻¹]+$/u;
const GL_SUBS={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','ₐ':'a','ₑ':'e','ₒ':'o','ₓ':'x','ₕ':'h','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₚ':'p','ₛ':'s','ₜ':'t','ᵢ':'i','ⱼ':'j','ᵣ':'r','ᵤ':'u','ᵥ':'v','ᵧ':'y'};
// v₀ → v_0, θₑ → θ_e
const glNorm=k=>k.replace(/[₀-₉ₐₑₒₓₕₖₗₘₙₚₛₜᵢⱼᵣᵤᵥᵧ]+/gu,m=>'_'+[...m].map(c=>GL_SUBS[c]).join(''));
const glPlain=h=>{let s=String(h);for(let k=0;k<3;k++)s=s.replace(/<sub>([^<]*)<\/sub>/g,'_$1');
  return s.replace(/<sup>([^<]*)<\/sup>/g,'$1').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').trim();};
const glKeyOk=k=>/^[\p{L}][\p{L}\p{M}\p{N}_]*$/u.test(k);
let GL=null;
function glIndex(){
  if(GL)return GL;
  const reg=[],sym={};   // sym[group][key] = registry index
  const add=(g,keys,s,d,u,title)=>{const i=reg.push({kind:'sym',sym:s,def:d,unit:u||'',src:title})-1;sym[g]=sym[g]||{};
    for(const k of keys){const kk=glNorm(k).replace(GL_MODS,'').replace(/_N_p$/,'_Np');if(glKeyOk(kk)&&!(kk in sym[g]))sym[g][kk]=i;}};
  for(const[g,keys,s,d,u]of GL_SYM_EXTRA){const G=NOMEN.find(x=>x.id===g);add(g,keys,s,d,u,G?G.title:GL_TITLES[g]||'');}   // first: they fix keys NOMEN gets wrong for prose
  for(const G of NOMEN){if(G.id==='map')continue;
    for(const[s,d,u]of G.rows){if(/<b>/.test(s))continue;add(G.id,glPlain(s).split(/,\s*/),s,d,u,G.title);}}
  const words={},alts=[];
  for(const[keys,d]of GL_WORDS){const i=reg.push({kind:'word',sym:keys[0],def:d,unit:'',src:'Term'})-1;for(const k of keys){words[k.toLowerCase()]=i;alts.push(k);}}
  alts.sort((a,b)=>b.length-a.length);
  const wre=new RegExp(`(?<![\\p{L}\\p{N}])(${alts.map(a=>a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})(?:e?s)?(?![\\p{L}\\p{N}*])`,'giu');
  return GL={reg,sym,words,wre,deriv:{}};
}
function glFind(k,ctx){const I=glIndex();for(const g of glGroups(ctx)){const m=I.sym[g];if(m&&k in m)return m[k];}return -1;}
// Look a token up: as written, without superscripts, without a braced or index subscript; a dotted letter is a time derivative
function glLookup(tok,ctx){
  const n=glNorm(tok).replace(GL_MODS,'');if(!n)return -1;
  for(const k of[n,n.replace(/[ᵀ'′²³⁻¹]/gu,''),n.replace(/_\{.*\}$/u,''),n.replace(/_(k|i|j|n|k\+1)$/u,'')]){const i=glFind(k,ctx);if(i>=0)return i;}
  const d=n.normalize('NFD');if(d.includes('̇')){const base=d.replace(/̇/g,'').normalize('NFC'),b=glLookup(base,ctx);if(b>=0){const I=glIndex(),key=b+'|'+tok;
    if(!(key in I.deriv)){const r=I.reg[b];I.deriv[key]=I.reg.push({kind:'sym',sym:tok,def:`Rate of change of: ${r.def.charAt(0).toLowerCase()+r.def.slice(1)}`,unit:r.unit&&!/,/.test(r.unit)?`${r.unit}/s`:'',src:r.src})-1;}return I.deriv[key];}}
  return -1;
}
const GL_TOK=/[\p{L}][\p{L}\p{M}\p{N}]*(?:_(?:\{[^}]*\}|[\p{L}\p{N}]+))*/gu;
// A lone Latin letter is a symbol in a formula, but not a unit after a number ("0.4 m") or an article before a word ("a heading")
function glLoneOk(text,start,end){if(/\d\s*$/.test(text.slice(0,start)))return false;return!/^\s+[a-z]{2,}/.test(text.slice(end));}
// symbol matches in one text: [start, end, registry index]
function glSymMatches(text,ctx,inEq,inI){
  const out=[];GL_TOK.lastIndex=0;let m;
  while((m=GL_TOK.exec(text))){const tok=m[0],s=m.index,base=tok.replace(GL_MODS,'');if(!base)continue;
    const ascii=/^[\x00-\x7f]*$/.test(base);
    if(inI&&tok.length!==text.trim().length)continue;   // <i>: the whole element or nothing
    if(ascii&&base.length===1&&!inI&&!(inEq&&glLoneOk(text,s,s+tok.length)))continue;   // lone Latin letters: formulas and <i> only
    if(ascii&&!inEq&&!inI&&!/[_A-Z]/.test(base))continue;   // a lowercase word in prose is a word, not a symbol
    const euler=base==='e'&&/^[\^⁻]/.test(text.slice(s+tok.length));   // e^(…), e⁻ˣ: the exponential, not an error
    const i=glLookup(euler?'ℯ':tok,ctx);
    if(i>=0){out.push([s,s+tok.length,i]);continue;}
    if(!inEq||!(/[^\x00-\x7f]|_/.test(tok)))continue;
    // a function applied to a symbol: sinθ, cosθ
    const f=/^(sin|cos|tan|exp|ln|log)(.+)$/.exec(tok);if(f){const k=glLookup(f[2],ctx);if(k>=0){out.push([s+f[1].length,s+tok.length,k]);continue;}}
    // juxtaposed symbols in a formula: HΣHᵀ, vΔt, sT_d, v₀k_θ (longest known prefix first)
    const parts=[];let j=0,ok=true;
    while(j<tok.length){let e=Math.min(tok.length,j+8),hit=-1;
      for(;e>j;e--){if(/[\p{M}ᵀ]/u.test(tok[e]||''))continue;const k=glLookup(tok.slice(j,e),ctx);if(k>=0){hit=k;break;}}
      if(hit<0){ok=false;break;}parts.push([s+j,s+e,hit]);j=e;}
    if(ok&&parts.length>1)out.push(...parts);
  }
  return out;
}
function glSpan(i,nodes){const sp=document.createElement('span');sp.className='term';sp.tabIndex=0;sp.dataset.gl=i;for(const n of nodes)sp.appendChild(n);return sp;}
// Annotate a rendered body. opt.list adds the "Terms" list; opt.closed renders it collapsed.
function glossify(root,ctx,opt){
  if(!root||root.dataset.gloss)return;root.dataset.gloss=String(ctx);opt=opt||{};
  const I=glIndex(),used=new Set(),order=[];const note=i=>{if(!used.has(i)){used.add(i);order.push(i);}};
  const skip=n=>n.closest('button,.tries,.term,summary,h3,a,.gl-terms,textarea,select');
  // x<sub>y</sub> and <i>x</i><sub>y</sub> written as HTML
  for(const sub of [...root.querySelectorAll('sub')]){if(skip(sub)||!sub.isConnected)continue;const p=sub.previousSibling;if(!p)continue;
    const key=t=>glLookup(t+'_'+sub.textContent.trim(),ctx);
    if(p.nodeType===1&&p.tagName==='I'&&!skip(p)){const i=key(p.textContent.trim());if(i>=0){const sp=glSpan(i,[]);p.replaceWith(sp);sp.appendChild(p);sp.appendChild(sub);note(i);}continue;}
    if(p.nodeType!==3)continue;const m=/([\p{L}][\p{L}\p{M}]*)$/u.exec(p.nodeValue);if(!m)continue;
    const i=key(m[1]);if(i<0)continue;const tail=p.splitText(p.nodeValue.length-m[1].length);
    const sp=glSpan(i,[]);tail.replaceWith(sp);sp.appendChild(tail);sp.appendChild(sub);note(i);}
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),texts=[];while(walker.nextNode())texts.push(walker.currentNode);
  for(const tn of texts){const el=tn.parentElement;if(!el||skip(el))continue;const text=tn.nodeValue;if(!text.trim())continue;
    const inEq=!!el.closest('.eq'),inI=el.tagName==='I';
    const ms=glSymMatches(text,ctx,inEq,inI);
    if(!inEq&&!inI){I.wre.lastIndex=0;let m;while((m=I.wre.exec(text))){const i=I.words[m[1].toLowerCase()];if(i==null||used.has(i))continue;ms.push([m.index,m.index+m[0].length,i]);}}
    if(!ms.length)continue;ms.sort((a,b)=>a[0]-b[0]||b[1]-a[1]);
    const fr=document.createDocumentFragment();let at=0;
    for(const[s,e,i]of ms){if(s<at)continue;if(I.reg[i].kind==='word'&&used.has(i))continue;
      if(s>at)fr.appendChild(document.createTextNode(text.slice(at,s)));fr.appendChild(glSpan(i,[document.createTextNode(text.slice(s,e))]));note(i);at=e;}
    if(at<text.length)fr.appendChild(document.createTextNode(text.slice(at)));tn.replaceWith(fr);}
  if(opt.list&&order.length){const d=document.createElement('details');d.className='gl-terms';if(!opt.closed)d.open=true;
    const syms=order.filter(i=>I.reg[i].kind==='sym'),words=order.filter(i=>I.reg[i].kind==='word');
    const row=i=>{const r=I.reg[i];return`<dt>${r.sym}</dt><dd>${r.def}${r.unit?` <span class="unit">[${r.unit}]</span>`:''}</dd>`;};
    d.innerHTML=`<summary>Terms in this ${opt.what||'lesson'} (${order.length})</summary>${syms.length?`<h4>Symbols</h4><dl>${syms.map(row).join('')}</dl>`:''}${words.length?`<h4>Words</h4><dl class="gl-words">${words.map(row).join('')}</dl>`:''}`;
    root.appendChild(d);}   // after the Try buttons, so the actions stay next to the text
}
// ---- the pop-up: hover with a mouse, tap on touch, focus with the keyboard; Escape or a tap elsewhere closes it ----
let glPop=null,glAt=null,glPtr='mouse',glWasOpen=null;
function glShow(t){
  const r=glIndex().reg[+t.dataset.gl];if(!r)return;
  if(!glPop){glPop=document.createElement('div');glPop.className='gl-pop';glPop.id='gl-pop';glPop.setAttribute('role','tooltip');document.body.appendChild(glPop);}
  if(glAt&&glAt!==t)glAt.removeAttribute('aria-describedby');glAt=t;t.setAttribute('aria-describedby','gl-pop');
  glPop.innerHTML=`<div class="gl-sym">${r.sym}</div><div class="gl-def">${r.def}${r.unit?` <span class="unit">[${r.unit}]</span>`:''}</div>${r.src?`<div class="gl-src">${r.src}</div>`:''}`;
  glPop.hidden=false;glPop.style.maxWidth=Math.min(300,innerWidth-16)+'px';
  const b=t.getBoundingClientRect(),ph=glPop.offsetHeight,w=glPop.offsetWidth;let x=Math.min(Math.max(8,b.left),innerWidth-w-8),y=b.bottom+6;
  if(y+ph>innerHeight-8&&b.top-ph-6>8)y=b.top-ph-6;glPop.style.left=x+'px';glPop.style.top=y+'px';
}
function glHide(){if(glPop)glPop.hidden=true;if(glAt){glAt.removeAttribute('aria-describedby');glAt=null;}}
document.addEventListener('pointerdown',e=>{glPtr=e.pointerType;glWasOpen=glPop&&!glPop.hidden?glAt:null;},true);   // before focus opens it
document.addEventListener('pointerover',e=>{if(e.pointerType!=='mouse')return;const t=e.target.closest&&e.target.closest('.term');if(t)glShow(t);});
document.addEventListener('pointerout',e=>{if(e.pointerType!=='mouse'||!glAt)return;const to=e.relatedTarget;if(!to||!(to.closest&&to.closest('.term')===glAt))glHide();});
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('.term');if(!t)return glHide();
  if(glPtr!=='mouse'&&glWasOpen===t)glHide();else glShow(t);});   // touch: a second tap on the same term closes it
document.addEventListener('focusin',e=>{const t=e.target.closest&&e.target.closest('.term');if(t)glShow(t);});
document.addEventListener('focusout',e=>{if(glAt&&e.target===glAt)glHide();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')glHide();});
window.addEventListener('scroll',glHide,true);window.addEventListener('resize',glHide);
// For the tests: formula tokens in a rendered body that look like symbols but got no definition
function glReport(root){
  const miss=new Map();
  for(const eq of root.querySelectorAll('.eq')){const w=document.createTreeWalker(eq,NodeFilter.SHOW_TEXT);
    while(w.nextNode()){const n=w.currentNode;if(n.parentElement.closest('.term'))continue;const t=n.nodeValue;GL_TOK.lastIndex=0;let m;
      while((m=GL_TOK.exec(t))){const tok=m[0],base=tok.replace(GL_MODS,''),ascii=/^[\x00-\x7f]*$/.test(base);if(!base)continue;
        if(ascii&&base.length===1&&!glLoneOk(t,m.index,m.index+tok.length))continue;if(ascii&&base.length>1&&!/_/.test(base))continue;
        miss.set(tok,(miss.get(tok)||0)+1);}}}
  return[...miss.entries()];
}
// Every lesson and note through the glossary, off-screen: terms found and formula symbols still undefined
function glCoverage(){
  const out=[],run=(id,ctx,html)=>{const d=document.createElement('div');d.className='how-body';d.innerHTML=html;d.style.display='none';document.body.appendChild(d);
    glossify(d,ctx,{list:true});out.push({id,terms:d.querySelectorAll('.gl-terms dt').length,miss:glReport(d)});d.remove();};
  for(const G of LESSON_GROUPS())G.items.forEach((L,i)=>run(`${G.id}:${i+1} ${L.t}`,glCtxFor(`${G.id}:${i}`),L.b));
  for(const t of Object.keys(NOTES))run(`note:${t}`,t,NOTES[t]);
  return out;
}
window.__gloss={glCoverage,glIndex,glLookup,glossify,glCtxFor};
