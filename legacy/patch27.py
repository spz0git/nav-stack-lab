# ---- patch 27: Phase 1 content — Try buttons, nomenclature, tooltips, first-run cue ----
import re

# ---------- Try items become buttons ----------
def tries_block(level_id, items):
    return "  tries:[\n"+",\n".join("   {t:%s,b:[%s]}"%(t, ",".join("[%s,%s]"%(l,c) for l,c in b)) for t,b in items)+"],"

TRY={
'L1':[
 ("'<b>Control:</b> drop pure-pursuit L<sub>0</sub> to 0.1 m, then raise it to 2 m. Watch the cross-track plot: short lookahead oscillates, long lookahead cuts corners.'",
  [("'L<sub>0</sub> = 0.1 m'","{set:{ppL0:0.1},tab:'ctl',plot:'cte'}"),("'L<sub>0</sub> = 2 m'","{set:{ppL0:2},tab:'ctl',plot:'cte'}")]),
 ("'<b>Control:</b> switch to PID and compare the same legs.'",[("'PID'","{set:{ctl:'pid'},tab:'ctl',plot:'cte'}")]),
 ("'<b>Vehicle:</b> turn on acceleration limits and set lag τ to 0.3 s. The speed plot shows command and response diverge.'",
  [("'Limits on, τ = 0.3 s'","{set:{accel:true,lag:0.3},tab:'veh',plot:'v'}")]),
 ("'<b>Control:</b> MPC. Compare cross-track RMS with pure pursuit. Shrink Np to 3 (myopic) and Nc to 1 (one held move). With lag τ = 0.3 s, tick Include actuator lag and compare.'",
  [("'MPC'","{set:{ctl:'mpc'},tab:'ctl',plot:'cte'}"),("'N<sub>p</sub> = 3, N<sub>c</sub> = 1'","{set:{ctl:'mpc',mpcNp:3,mpcNc:1},tab:'ctl',plot:'cte'}"),("'τ = 0.3 s, lag modeled'","{set:{ctl:'mpc',lag:0.3,mpcLag:true},tab:'ctl',plot:'v'}")])],
'L2':[
 ("'<b>Plan:</b> pick Straight line and run. The robot drives into a shelf and the stuck detector fires.'",[("'Straight line'","{set:{plan:'straight'},tab:'plan'}")]),
 ("'<b>Plan:</b> A* with ε = 1 versus ε = 3. Compare expansions and path length in the log (weighted A* is bounded by ε × optimal).'",
  [("'ε = 1'","{set:{plan:'astar',eps:1},tab:'plan'}"),("'ε = 3'","{set:{plan:'astar',eps:3},tab:'plan'}")]),
 ("'<b>Plan:</b> RRT*, then change the seed and reset. Sampling planners give a different path every time.'",
  [("'RRT*'","{set:{plan:'rrtstar'},tab:'plan'}"),("'RRT*, next seed'","{seed:'next',set:{plan:'rrtstar'},tab:'plan'}")]),
 ("'<b>Mission:</b> Optimal versus In order. The log shows total mission cost for each.'",
  [("'In order'","{set:{mis:'sequential'},tab:'mis'}"),("'Optimal'","{set:{mis:'optimal'},tab:'mis'}")])],
'L3':[
 ("'<b>Localize:</b> the level starts on dead reckoning. Watch the truth and the estimate separate, and the ellipse grow.'",[("'Dead reckoning'","{set:{loc:'dr'},tab:'loc',plot:'pos'}")]),
 ("'<b>Localize:</b> switch to EKF. Then raise odometry bias in Vehicle and watch NEES climb past 3: the filter becomes overconfident.'",
  [("'EKF'","{set:{loc:'ekf'},tab:'loc',plot:'pos'}"),("'EKF, bias ×3'","{set:{loc:'ekf',odoB:3},tab:'veh',plot:'pos'}")]),
 ("'<b>Localize:</b> raise the filter\\'s assumed motion noise until NEES settles near 3 again.'",[("'EKF, bias ×3, assumed noise ×4'","{set:{loc:'ekf',odoB:3,filtK:4},tab:'loc',plot:'pos'}")]),
 ("'<b>Localize:</b> kidnap the robot. With known IDs the EKF can pull itself back. With unlabeled beacons the gate rejects every reading. The particle filter recovers either way.'",
  [("'EKF, kidnap at 8 s'","{set:{loc:'ekf'},tab:'loc',plot:'pos',act:'kidnap'}"),("'Unlabeled, kidnap'","{set:{loc:'ekf',assoc:'unknown'},tab:'loc',plot:'pos',act:'kidnap'}"),("'Particle filter, kidnap'","{set:{loc:'pf',assoc:'unknown'},tab:'loc',plot:'pos',act:'kidnap'}")])],
'L4':[
 ("'<b>Mission:</b> follow the replans in the event log as rooms are discovered.'",[("'Run'","{tab:'mis'}")]),
 ("'<b>Perceive:</b> set unknown space to lethal. Goals in unexplored rooms become unreachable, which is the gap frontier-based exploration fills.'",[("'Unknown = lethal'","{set:{unknownAs:'lethal'},tab:'per'}")]),
 ("'<b>Localize:</b> switch to dead reckoning and watch the map smear: mapping inherits pose error.'",[("'Dead reckoning'","{set:{loc:'dr'},tab:'loc'}")]),
 ("'<b>Layers:</b> hide the true-map ghost and judge the map as the robot sees it.'",[("'Hide the ghost'","{layers:{ghost:false},tab:'view',keep:true}")]),
 ("'<b>Control:</b> MPC with obstacle constraints handles the tight rooms. Switch it to LTV, which cannot take nonconvex obstacle constraints, and watch it clip the table.'",
  [("'MPC'","{set:{ctl:'mpc'},tab:'ctl'}"),("'LTV'","{set:{ctl:'mpc',mpcMode:'ltv'},tab:'ctl'}")])],
'L5':[
 ("'<b>Control:</b> pure pursuit runs with the response to agents set to Speed planning: it keeps its path and slows or waits for people predicted to cross it. Open the ST graph in Telemetry. Then set it to Ignore, then Reactive stop, and compare people contacts.'",
  [("'Speed planning'","{tab:'ctl',plot:'st'}"),("'Ignore'","{set:{spd:'none'},tab:'ctl'}"),("'Reactive stop'","{set:{spd:'stop'},tab:'ctl'}")]),
 ("'<b>Perceive:</b> set Prediction to Static (frozen). The planner then reacts only to where people are now, and the robot pulls into gaps that are about to close.'",[("'Static prediction'","{set:{agPred:'static'},tab:'per',plot:'st'}")]),
 ("'<b>Perceive:</b> switch Agent tracking from Lidar to Ground truth. The difference is what tracking costs: late confirmation, noisy velocity, coasting through occlusion.'",[("'Ground truth'","{set:{agents:'truth'},tab:'per'}")]),
 ("'<b>Control:</b> DWA and MPC use the predictions too, as time-indexed obstacles. Compare them with Agent tracking off, which treats every lidar hit as a static obstacle at the moment of the scan. MPC respects the acceleration limits exactly; tick Include actuator lag, since τ = 0.15 s here.'",
  [("'DWA'","{set:{ctl:'dwa'},tab:'ctl'}"),("'DWA, tracking off'","{set:{ctl:'dwa',agents:'off'},tab:'ctl'}"),("'MPC'","{set:{ctl:'mpc',mpcLag:true},tab:'ctl'}"),("'MPC, tracking off'","{set:{ctl:'mpc',mpcLag:true,agents:'off'},tab:'ctl'}")]),
 ("'<b>Localize:</b> scatter the particles. With unlabeled beacons this warehouse is nearly 180° symmetric, so the filter can lock onto the mirror pose. Switch to Known IDs and scatter again.'",
  [("'Scatter at 8 s'","{tab:'loc',act:'scatter'}"),("'Known IDs, scatter'","{set:{assoc:'known'},tab:'loc',act:'scatter'}")]),
 ("'<b>Vehicle:</b> raise false detections and watch gating and robust weights hold.'",[("'2 false detections per scan'","{set:{clutter:2},tab:'veh'}")])],
'L6':[
 ("'<b>Plan:</b> watch Hybrid A* insert reverse legs (dashed orange). Then switch to A*: the path ignores heading and turning radius, so the car swings wide and misses the bay.'",
  [("'Hybrid A*'","{tab:'plan'}"),("'A*'","{set:{plan:'astar'},tab:'plan'}")]),
 ("'<b>Plan:</b> pick Reeds–Shepp. It finds the shortest maneuver but ignores obstacles, so it drives through parked cars.'",[("'Reeds–Shepp'","{set:{plan:'rs'},tab:'plan'}")]),
 ("'<b>Plan:</b> untick Allow reversing. The reverse-in bay and the parallel slot become unreachable or far longer.'",[("'No reversing'","{set:{revOK:false},tab:'plan'}")]),
 ("'<b>Plan:</b> set the heuristic to 2D only and compare expansions in the log. Then raise Steering used by the planner to 100%: full-lock arcs leave the tracker no room to correct.'",
  [("'2D heuristic'","{set:{hybH:'2d'},tab:'plan'}"),("'Planner at 100 %'","{set:{planPct:100},tab:'plan'}")]),
 ("'<b>Control:</b> DWA follows the plan into a bay but stops short. It scores distance to a carrot, not the final pose, so it is a local avoider rather than a parking controller.'",[("'DWA'","{set:{ctl:'dwa'},tab:'ctl'}")]),
 ("'<b>Control:</b> the default is rear-wheel feedback (curvature feedforward). Switch to pure pursuit and watch it cut the inside of full-lock arcs. Then try Stanley and lower the steering rate limit in Vehicle.'",
  [("'Pure pursuit'","{set:{ctl:'pp'},tab:'ctl',plot:'cte'}"),("'Stanley, rate 0.5 rad/s'","{set:{ctl:'stanley',steerRate:0.5},tab:'veh',plot:'turn'}")]),
 ("'<b>Localize:</b> switch to EKF and raise odometry noise. The log reports the true final pose error at every bay.'",[("'EKF, noise ×2'","{set:{loc:'ekf',odoK:2},tab:'loc',plot:'pos'}")]),
 ("'<b>Control:</b> MPC knows the steering-rate limit, so it needs no dry-steering rule at cusps. Switch it to LTV and watch the dashed linear prediction drift from the true one at the start of each leg.'",
  [("'MPC'","{set:{ctl:'mpc'},tab:'ctl'}"),("'LTV'","{set:{ctl:'mpc',mpcMode:'ltv'},tab:'ctl'}")]),
 ("'<b>Control:</b> people cross the lanes. With the response to agents set to Speed planning the car keeps its maneuver and picks a speed that lets them pass; the ST graph in Telemetry shows why. Set it to Ignore and count contacts, then Reactive stop.'",
  [("'Speed planning'","{tab:'ctl',plot:'st'}"),("'Ignore'","{set:{spd:'none'},tab:'ctl'}"),("'Reactive stop'","{set:{spd:'stop'},tab:'ctl'}")]),
 ("'<b>Perceive:</b> set Prediction to Static (frozen), or the horizon to 1 s. The car stops treating crossing people as future obstacles and noses into their way.'",
  [("'Static prediction'","{set:{agPred:'static'},tab:'per',plot:'st'}"),("'Horizon 1 s'","{set:{agT:1},tab:'per',plot:'st'}")])],
}
for lid,items in TRY.items():
    i0=s.index("{id:'%s',"%lid); a=s.index("  tries:[",i0); b=s.index("],\n",a)+3
    s=s[:a]+tries_block(lid,items)+"\n"+s[b:]

# brief: tries rendered with buttons; heading reworded
rep("""  $('#brief').innerHTML=`<div><h3>${LV.id} adds</h3><p class="adds">${LV.adds}</p></div><details class="try" ${tryOpen?'open':''}><summary><h3>Try (${LV.tries.length})</h3></summary><ul>${LV.tries.map(t=>`<li>${t}</li>`).join('')}</ul></details>`;
  $('#brief .try').ontoggle=e=>{tryOpen=e.target.open;};""",
"""  $('#brief').innerHTML=`<div><h3>What ${LV.id} adds</h3><p class="adds">${LV.adds}</p></div><details class="try" ${tryOpen?'open':''}><summary><h3>Try (${LV.tries.length}) · each button sets the lab up and runs</h3></summary><ul>${LV.tries.map((t,i)=>`<li>${t.t}<div class="tries">${t.b.map((x,j)=>`<button class="btn small" data-lt="${i}:${j}">${x[0]}</button>`).join('')}</div></li>`).join('')}</ul></details>`;
  $('#brief .try').ontoggle=e=>{tryOpen=e.target.open;};
  $('#brief').querySelectorAll('[data-lt]').forEach(b=>b.onclick=()=>{const[i,j]=b.dataset.lt.split(':').map(Number);tryGo(LV.tries[i].b[j][1]);});""")
# tryGo: reload the level (fresh), apply, show the right tab and plot, run; optional timed action
rep("function loadLevel(i){",
"""async function tryGo(cfg){
  firstRunDone();
  if(cfg.seed==='next')P.seed=P.seed%99+1;
  if(!cfg.keep)loadLevel(LEVELS.indexOf(LV));
  for(const[k,v]of Object.entries(cfg.set||{}))setParam(k,v,false);
  if(cfg.layers)Object.assign(LAYERS,cfg.layers);
  if(cfg.tab){activeTab=cfg.tab;buildTabs();}renderAllPanes();
  if(cfg.plot){plotCh=cfg.plot;seg($('#plotsel'),PLOT_OPTS,()=>plotCh,v=>{plotCh=v;drawPlot();});}
  if(AN.mode!=='sim')setMode('sim');
  if(cfg.keep){draw();return;}
  if((S.fsm.state==='IDLE'||S.fsm.state==='DONE')&&remaining().length)startMission();
  if(cfg.act){running=false;await advance(160);
    if(cfg.act==='kidnap')kidnapTo(null);else if(cfg.act==='scatter')scatterParticles();}
  running=true;refreshAll();
}
function kidnapTo(p){   // p = [x, y] or null for a free spot far from the robot
  const r=S.robot;let best=null;
  if(!p){for(let i=0;i<400;i++){const x=1+S.rngA.u()*(W-2),y=1+S.rngA.u()*(H-2),k=cellIdx(x,y);if(k<0||LV.truthDist[k]<0.8)continue;const d=hyp(x-r.x,y-r.y);if(d>6&&(!best||d>best[2]))best=[x,y,d];if(best&&best[2]>12)break;}
    if(!best)return;p=best;}
  r.x=p[0];r.y=p[1];r.v=0;r.w=0;r.d=0;r.contact=false;S.trailT.push(null);
  logE(`Robot kidnapped to (${p[0].toFixed(1)}, ${p[1].toFixed(1)}). The estimate was not told.`,'bad');draw();refreshAll();
}
function loadLevel(i){""")

# ---------- nomenclature ----------
rep("<option value=\"wp\">Add waypoint</option>","<option value=\"wp\">Add goal</option>")
rep("<option value=\"pose\">Posed goal (drag)</option>","<option value=\"pose\">Goal with heading (drag)</option>")
rep("<option value=\"goal\">Single goal</option>\n          <option value=\"kidnap\">Kidnap robot</option>","<option value=\"goal\">Replace all goals</option>")
rep("""        <button class="btn" id="clearwp" title="Clear all waypoints">Clear</button>""",
"""        <button class="btn" id="clearwp" title="Remove every goal">Clear goals</button>
        <span class="ctl-sep"></span>
        <button class="btn" id="kidnapb" title="Then tap the map where the robot should be teleported (the estimator is not told)" aria-pressed="false">Kidnap…</button>""")
rep('aria-label="Simulation map. Tap to add waypoints."','aria-label="Simulation map. Tap to add goals; scroll to zoom; drag to pan."')
rep("'IDLE · add waypoints'","'IDLE · tap the map to add goals'")
rep("""   <span class="kv">waypoints <b>${done}/${WPS.length}</b></span>""","""   <span class="kv">goals <b>${done}/${WPS.length}</b></span>""")
rep("logE(`Mission: ${F.queue.length} waypoint${F.queue.length>1?'s':''},","logE(`Mission: ${F.queue.length} goal${F.queue.length>1?'s':''},")
rep("logE(`Skipping WP ${wpLabel(F.queue[0])} after 3 attempts`,'bad')","logE(`Skipping goal ${wpLabel(F.queue[0])} after 3 attempts`,'bad')")
rep("logE(`Reached WP ${wpLabel(F.queue[0])} by estimate","logE(`Reached goal ${wpLabel(F.queue[0])} by estimate")
rep("logE(`Skipping WP ${wpLabel(F.queue[0])}: stuck 3 times`,'bad')","logE(`Skipping goal ${wpLabel(F.queue[0])}: stuck 3 times`,'bad')")
rep("logE(`${name}: no path to WP ${wpLabel(F.queue[0])} (${res.reason})`,'bad');","logE(`${name}: no path to goal ${wpLabel(F.queue[0])} (${res.reason})`,'bad');")
rep("logE('All waypoints done. Tap the map to add more.','warn')","logE('All goals done. Tap the map to add more.','warn')")
rep("logE('Up to 8 open waypoints','warn');return;}\n  WPS.push","logE('Up to 8 open goals','warn');return;}\n  WPS.push")
rep("else{if(remaining().length>=8){logE('Up to 8 open waypoints','warn');return;}","else{if(remaining().length>=8){logE('Up to 8 open goals','warn');return;}")
rep("logE('Waypoints cleared');","logE('Goals cleared');")
rep("so localization error shows up as missed waypoints","so localization error shows up as missed goals")
rep("from the robot and every waypoint. Optimal","from the robot and every goal. Optimal")
rep("replaces the path with the farthest visible waypoint, keeping","replaces the path with the farthest visible path point, keeping")
rep("`Path cost from waypoint ${I('i')} to ${I('j')} (Dijkstra on the costmap), used to order waypoints`","`Path cost from goal ${I('i')} to ${I('j')} (Dijkstra on the costmap), used to order goals`")
rep("'Active waypoint; numbers give the visiting order; a dashed body and tick show a goal heading'","'Active goal; numbers give the visiting order; a dashed body and tick show a goal heading'")
rep("// obs.goal   {x, y}          current waypoint","// obs.goal   {x, y}          current goal")
rep("{k:'agents',type:'seg',label:'Moving agents',opts:[['off','Not tracked'],['truth','Ground truth'],['lidar','Lidar tracker']]},",
    "{k:'agents',type:'seg',label:'Agent tracking',opts:[['off','Off'],['truth','Ground truth'],['lidar','Lidar (clusters + Kalman)']]},")
rep("logE(`Moving agents → ${({off:'not tracked',truth:'ground truth',lidar:'lidar tracker'})[v]}`)","logE(`Agent tracking → ${({off:'off',truth:'ground truth',lidar:'lidar'})[v]}`)")
rep("{k:'spd',type:'seg',label:'Moving agents',opts:","{k:'spd',type:'seg',label:'Response to agents',opts:")
rep("'Speed planning needs agent tracking: Perceive → Moving agents.'","'Speed planning needs agent tracking: Perceive → Agent tracking.'")
rep("logE(`Agents (path trackers) → ${","logE(`Response to agents → ${")
rep("<p><b>Moving agents.</b> The lidar tracker takes","<p><b>Agent tracking.</b> The lidar tracker takes")
rep("<p><b>Moving agents with a path tracker: speed planning.</b>","<p><b>Response to agents with a path tracker: speed planning.</b>")
rep("<p><b>Moving agents.</b> The global plan ignores them","<p><b>Agents and the global plan.</b> The global plan ignores them")
# spelling: American
for a,b in [("behaviour","behavior"),("Behaviour","Behavior"),("centre","center"),("Centre","Center"),("manoeuvre","maneuver"),("modelled","modeled"),("Modelled","Modeled"),("tyre","tire"),("colour","color")]:
    s=s.replace(a,b)
# Unicode subscripts → <sub> in HTML prose (not in .eq blocks, not in canvas strings)
SUB={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','ₐ':'a','ₑ':'e','ₒ':'o','ₓ':'x','ₕ':'h','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₚ':'p','ₛ':'s','ₜ':'t'}
pat=re.compile('['+''.join(SUB)+']+')
def desub(txt):
    parts=re.split(r'(<div class="eq">.*?</div>)',txt,flags=re.S)
    out=[]
    for i,p in enumerate(parts):
        if i%2==1:out.append(p);continue
        out.append(pat.sub(lambda m:'<sub>'+''.join(SUB[c] for c in m.group(0))+'</sub>',p))
    return ''.join(out)
def region(start,end):
    global s
    a=s.index(start);b=s.index(end,a);s=s[:a]+desub(s[a:b])+s[b:]
region("const LEVELS=[","const DEFAULTS=")
region("const SCHEMA={","function buildLevels(){")
region("const LESSONS=[","function learnPane(){")
# chip and metric labels: no forced upper case, so symbols keep their case
rep(".chip span{font-size:.66rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}",".chip span{font-size:.72rem;letter-spacing:.02em;color:var(--muted)}")
rep(".metrics dt{font-size:.66rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);white-space:nowrap}",".metrics dt{font-size:.72rem;letter-spacing:.02em;color:var(--muted);white-space:nowrap}")
rep("['NEES (≈3 = consistent)',nees==null?'— (no covariance)':","['NEES (3 = consistent)',nees==null?'—':")

# ---------- parameter tooltips, changed-from-default marks, per-field reset ----------
rep("function fieldHTML(f){",
"""const TIPS={loc:'Which estimator produces the pose the planner and controller use.',assoc:'Whether beacon readings carry their ID. Unlabeled readings are matched by Mahalanobis distance.',npart:'More particles cost CPU and resolve the belief more finely.',inject:'Replace low-weight particles with poses sampled from beacon readings when the likelihood drops.',pfLidar:'Score particles against the prior map with 24 lidar beams.',filtK:'Motion noise the filter assumes, relative to the true noise. Too low makes it overconfident (NEES above 3).',
 per:'Prior map: the planner sees the true static map. Lidar mapping: an occupancy grid built from scans in the estimated frame.',unknownAs:'Whether unobserved cells block the planner.',infl:'Width of the soft cost band outside the lethal radius.',agents:'Off: people reach the stack only as lidar hits. Ground truth: perfect tracks. Lidar: clustering plus a Kalman filter per agent.',agPred:'Constant velocity extrapolates each track; Static freezes it where it is now.',agT:'How far ahead agents are predicted and the speed planner plans.',agGrow:'How fast the predicted radius grows per second of prediction.',agSigA:'White acceleration noise of the constant-velocity model. Higher follows turns faster but gives noisier velocity.',
 mis:'In order visits goals as numbered. Greedy picks the nearest next. Optimal solves the open-path TSP.',replan:'Replan on a timer in addition to the event-driven triggers.',lostGuard:'Stop when the position uncertainty exceeds 1 m.',
 plan:'Global planner on the costmap. Reeds–Shepp and Hybrid A* are car-only.',planPct:'Fraction of the steering limit the planner may use. The rest is margin for the tracker.',eps:'Heuristic weight. Above 1 the search is faster and the path up to ε times longer.',hybH:'Which heuristic guides Hybrid A*.',revOK:'Allow reverse legs with cusps.',revPen:'Cost multiplier on reverse distance.',gearPen:'Fixed cost for each change of direction.',rrtIt:'Samples per RRT* run.',smooth:'Shortcut the path with line-of-sight checks.',agPlan:'When the speed planner cannot avoid an agent, replan around its predicted positions.',
 ctl:'Path tracker that turns the plan into speed and steering.',vcruise:'Speed the reference profile aims for on straights.',spd:'How path trackers react to tracked agents. Ignore: not at all. Reactive stop: brake for hits in the corridor ahead. Speed planning: ST-graph speed profile against the predictions.',stMarg:'Clearance the speed planner keeps from predicted agents.',ppL0:'Lookahead distance at zero speed.',ppK:'Extra lookahead per m/s of speed.',alat:'Lateral acceleration cap that slows the robot in curves.',rwKth:'Heading-error gain of rear-wheel feedback. Higher damps more.',rwKe:'Lateral-error gain of rear-wheel feedback. Higher is stiffer.',stanK:'Stanley cross-track gain.',kp:'Proportional gain on heading error to the carrot.',ki:'Integral gain; removes steady error but adds phase lag.',kd:'Derivative gain on heading error.',dwaG:'DWA weight on distance and heading to the carrot.',dwaO:'DWA weight on clearance.',dwaV:'DWA weight on speed.',dwaT:'How far DWA rolls each candidate out.',
 mpcMode:'NMPC relinearizes every iteration; LTV linearizes once about the reference.',mpcNp:'Prediction horizon in steps of Δt.',mpcNc:'Free input moves; later moves are held at the last one.',mpcDt:'Prediction step.',mpcIt:'SQP iterations per 50 ms tick, within a 15 ms budget.',mpcQlat:'Penalty on lateral error.',mpcQlon:'Penalty on along-track error.',mpcQth:'Penalty on heading error.',mpcQv:'Penalty on speed error.',mpcQf:'Multiplier on the last step of the horizon.',mpcRa:'Penalty on acceleration input.',mpcRs:'Penalty on steering-rate or angular-acceleration input.',mpcRd:'Penalty on the change between consecutive moves.',mpcRho:'Augmented-Lagrangian penalty for the state constraints.',mpcObs:'Add clearance constraints against lidar points and predicted agents.',mpcMarg:'Extra clearance in the obstacle constraints.',mpcLag:'Model the first-order actuator lag with two more states.',
 model:'Unicycle turns in place; the bicycle model steers front wheels and needs motion to turn.',wheelbase:'Distance between axles.',steerMaxDeg:'Steering limit; sets the minimum turning radius.',steerRate:'How fast the steering angle can change.',vmax:'Speed limit.',wmax:'Turn-rate limit of the unicycle.',accel:'Enforce acceleration limits in the vehicle.',amax:'Linear acceleration limit.',alpha:'Angular acceleration limit.',lag:'First-order actuator time constant.',latency:'Ticks a command waits before reaching the actuators.',biasDeg:'Constant offset between commanded and actual steering angle.',biasW:'Constant offset in turn rate, as from one weak motor.',odoK:'Odometry noise scale.',odoB:'Odometry calibration bias the filters are not told about.',lmK:'Beacon range and bearing noise scale.',lmRange:'Beacon sensor range.',clutter:'False beacon detections per scan in unlabeled mode.',lidarSig:'Lidar range noise.',seed:'Seed of the world and sensor noise. Applied on Reset.'};
function lvlDefault(k){return k in (LV.cfg||{})?LV.cfg[k]:DEFAULTS[k];}
function chgMark(f){const d=lvlDefault(f.k);if(d===undefined||P[f.k]===d)return'';return`<button class="rst" data-reset="${f.k}" title="Back to this level's default (${fmtVal(f,d)})">↺</button>`;}
function fieldHTML(f){""")
rep("""  if(f.type==='seg')return`<div class="field"><span class="lbl">${f.label}</span><div class="seg" data-k="${f.k}">""",
    """  if(f.type==='seg')return`<div class="field${chgMark(f)?' chg':''}"><span class="lbl" title="${TIPS[f.k]||''}">${f.label}${chgMark(f)}</span><div class="seg" data-k="${f.k}">""")
rep("""  if(f.type==='bool')return`<label class="check"><input type="checkbox" id="p-${f.k}" data-k="${f.k}" ${P[f.k]?'checked':''}><span>${f.label}</span></label>`;""",
    """  if(f.type==='bool')return`<label class="check${chgMark(f)?' chg':''}" title="${TIPS[f.k]||''}"><input type="checkbox" id="p-${f.k}" data-k="${f.k}" ${P[f.k]?'checked':''}><span>${f.label}${chgMark(f)}</span></label>`;""")
rep("""  return`<div class="field"><div class="row"><label for="p-${f.k}">${f.label}</label><output id="o-${f.k}">${fmtVal(f,P[f.k])}</output></div>""",
    """  return`<div class="field${chgMark(f)?' chg':''}"><div class="row"><label for="p-${f.k}" title="${TIPS[f.k]||''}">${f.label}${chgMark(f)}</label><output id="o-${f.k}">${fmtVal(f,P[f.k])}</output></div>""")
rep("  pane.querySelectorAll('.seg[data-k]').forEach(sg=>",
    "  pane.querySelectorAll('[data-reset]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const k=b.dataset.reset;setParam(k,lvlDefault(k),false);renderAllPanes();});\n  pane.querySelectorAll('.seg[data-k]').forEach(sg=>")
rep(".field{display:flex;flex-direction:column;gap:5px}",
    ".field{display:flex;flex-direction:column;gap:5px}\n.rst{border:0;background:none;color:var(--accent);cursor:pointer;font-size:.9rem;padding:0 4px;line-height:1}\n.field.chg>.row label,.field.chg>.lbl,.check.chg span{color:var(--accent)}\n.hint{font-size:.85rem;color:var(--muted);background:var(--panel);border:1px dashed var(--line);border-radius:6px;padding:7px 10px;margin:0;display:flex;gap:10px;align-items:center;justify-content:space-between}\n.hint b{color:var(--ink)}\n.pill.ready{color:var(--accent)}")

# ---------- first-run cue + Ready pill ----------
rep("""      <div class="status" id="status"></div>""",
"""      <p class="hint" id="firstrun"><span><b>Press Run</b> to start the mission. Tap the map to add goals. Each level's <b>Try</b> list sets up an experiment with one click, and <b>Learn</b> has guided lessons.</span><button class="linkbtn" id="firstrun-x" type="button">Got it</button></p>
      <div class="status" id="status"></div>""")
rep("""  const st=F.state==='IDLE'&&WPS.length===0?'IDLE · tap the map to add goals':F.state.replace('_',' ');""",
    """  const ready=!running&&S.t===0&&(F.state==='DRIVE'||F.state==='PLAN');
  const st=F.state==='IDLE'&&WPS.length===0?'IDLE · tap the map to add goals':ready?'READY':F.state.replace('_',' ');""")
rep("""  $('#status').innerHTML=`<span class="pill ${STATE_CLS[F.state]}">${st}</span>""","""  $('#status').innerHTML=`<span class="pill ${ready?'ready':STATE_CLS[F.state]}">${st}</span>""")
rep("""$('#run').onclick=()=>{
  running=!running;""","""let firstRun=true;function firstRunDone(){if(!firstRun)return;firstRun=false;const h=$('#firstrun');if(h)h.hidden=true;}
$('#firstrun-x').onclick=firstRunDone;
$('#run').onclick=()=>{
  running=!running;if(running)firstRunDone();""")
# kidnap: button arms the tap mode; the select keeps the goal modes
rep("""$('#tapsel').onchange=e=>{tapMode=e.target.value;cv.style.touchAction=tapMode==='pose'?'none':'manipulation';};""",
"""$('#tapsel').onchange=e=>{tapMode=e.target.value;$('#kidnapb').setAttribute('aria-pressed','false');cv.style.touchAction=tapMode==='pose'?'none':'manipulation';};
$('#kidnapb').onclick=()=>{const on=tapMode!=='kidnap';tapMode=on?'kidnap':$('#tapsel').value;$('#kidnapb').setAttribute('aria-pressed',String(on));if(on)logE('Tap the map where the robot should be teleported','warn');};""")
rep("""    S.robot.x=x;S.robot.y=y;S.robot.v=0;S.robot.w=0;S.robot.d=0;S.robot.contact=false;S.trailT.push(null);
    logE(`Robot kidnapped to (${x.toFixed(1)}, ${y.toFixed(1)}). The estimate was not told.`,'bad');draw();refreshAll();return;""",
"""    kidnapTo([x,y]);tapMode=$('#tapsel').value;$('#kidnapb').setAttribute('aria-pressed','false');return;""")
rep("""seg($('#plotsel'),[['ex','x error'],['eth','θ error'],['cte','Cross-track'],['v','Speed'],['turn','Steering'],['st','ST graph']],()=>plotCh,v=>{plotCh=v;drawPlot();});""",
"""const PLOT_OPTS=[['pos','Position error'],['eth','θ error'],['cte','Cross-track'],['v','Speed'],['turn','Steering'],['st','ST graph']];
seg($('#plotsel'),PLOT_OPTS,()=>plotCh,v=>{plotCh=v;drawPlot();});""")
