
let tryOpen=false;   // the Try list starts collapsed so the map and telemetry fit on screen
let briefOpen=true;   // the level's description; folding it is remembered (workspace.js)
function buildLevels(){
  $('#levels').innerHTML=LEVELS.map((L,i)=>`<button class="lvl" data-i="${i}" aria-pressed="${L===LV}" title="${L.id} ${L.name}">${L.id}</button>`).join('');
  $('#levels').querySelectorAll('.lvl').forEach(b=>b.onclick=()=>loadLevel(+b.dataset.i));
  $('#brief').innerHTML=`<details class="adds-d" ${briefOpen?'open':''}><summary><h3>What ${LV.id} <span class="lvname">${LV.name}</span> adds</h3></summary><p class="adds">${LV.adds}</p></details><details class="try" ${tryOpen?'open':''}><summary><h3>Try (${LV.tries.length}) · each button sets the lab up and runs</h3></summary><ul>${LV.tries.map((t,i)=>`<li>${t.t}<div class="tries">${t.b.map((x,j)=>`<button class="btn small" data-lt="${i}:${j}">${x[0]}</button>`).join('')}</div></li>`).join('')}</ul></details>`;
  $('#brief .try').ontoggle=e=>{tryOpen=e.target.open;};
  $('#brief .adds-d').ontoggle=e=>{briefOpen=e.target.open;wsSave();};
  $('#brief').querySelectorAll('[data-lt]').forEach(b=>b.onclick=()=>{const[i,j]=b.dataset.lt.split(':').map(Number);tryGo(LV.tries[i].b[j][1]);});
}
async function tryGo(cfg){
  firstRunDone();
  if(cfg.seed==='next')P.seed=P.seed%99+1;
  if(cfg.level!=null)LV=LEVELS[cfg.level];
  if(!cfg.keep)loadLevel(LEVELS.indexOf(LV));
  for(const[k,v]of Object.entries(cfg.set||{}))setParam(k,v,false);
  if(cfg.tab){activeTab=cfg.tab;consoleOpen=true;buildTabs();}
  applyTabLayers();if(cfg.layers)Object.assign(LAYERS,cfg.layers);renderAllPanes();
  if(cfg.plot){plotCh=cfg.plot;seg($('#plotsel'),PLOT_OPTS,()=>plotCh,v=>{plotCh=v;drawPlot();});}
  if(cfg.panes){PANES.length=0;for(const p of cfg.panes)addPane(p.slice());if(WS.dockOff)wsDock(true);}   // added plots: a list of signal lists
  if(AN.mode!=='sim')setMode('sim');
  if(cfg.keep){draw();return;}
  if((S.fsm.state==='IDLE'||S.fsm.state==='DONE')&&remaining().length)startMission();
  if(cfg.act){running=false;await advance(160);
    if(cfg.act==='kidnap')kidnapTo(null);else if(cfg.act==='scatter')scatterParticles();}
  running=true;refreshAll();
}
let activeTab='loc';const howOpen={};
// Phones show the console as its tab row until a tab is tapped; tapping the open tab folds it again. Wide screens ignore this.
let consoleOpen=false;const narrowUI=()=>matchMedia('(max-width:760px)').matches;
// Show a Symbols group: scroll only the console on desktop (below its sticky tabs), the page on phones
function showSym(id){if(uiMode==='learn')setUIMode(AN.mode);activeTab='sym';consoleOpen=true;buildTabs();renderAllPanes();
  const el=document.getElementById('sym-'+id),c=document.querySelector('.right')||document.querySelector('.console');if(!el)return;
  if(c.scrollHeight>c.clientHeight+1&&getComputedStyle(c).overflowY!=='visible'){const tb=c.querySelector('.tabs').offsetHeight;
    c.scrollTop+=el.getBoundingClientRect().top-c.getBoundingClientRect().top-tb-8;}
  else el.scrollIntoView({block:'start'});}
// Simulate's tabs come in three groups; only the chosen group's tabs show. Each group remembers its last tab.
const groupTab={};
function buildTabs(){
  const G=TAB_GROUPS.find(g=>g.tabs.includes(activeTab))||TAB_GROUPS[0];groupTab[G.id]=activeTab;
  $('#tabgroups').innerHTML=TAB_GROUPS.map(g=>`<button id="tg-${g.id}" type="button" aria-pressed="${g===G}">${g.name}</button>`).join('');
  $('#tabgroups').querySelectorAll('button').forEach(b=>b.onclick=()=>{const g=TAB_GROUPS.find(x=>'tg-'+x.id===b.id);if(g===G&&consoleOpen)return;
    activeTab=groupTab[g.id]||g.tabs[0];consoleOpen=true;buildTabs();renderAllPanes();});
  $('#tabs').innerHTML=TABS.filter(t=>G.tabs.includes(t.id)).map(t=>`<button class="tab" role="tab" id="tab-${t.id}"${SYS[t.id]?` data-sys="${t.id}"`:''} aria-selected="${t.id===activeTab}" aria-controls="pane">${t.n?`<small>${t.n}</small>`:''}${t.name}</button>`).join('');
  $('#tabs').querySelectorAll('.tab').forEach(b=>b.onclick=()=>{const id=b.id.slice(4);
    if(id===activeTab&&consoleOpen&&narrowUI()){consoleOpen=false;buildTabs();return;}
    activeTab=id;consoleOpen=true;buildTabs();renderAllPanes();});
  $('.console').classList.toggle('collapsed',!consoleOpen);
}
function renderAllPanes(){
  applyTabLayers();
  const t=activeTab;let html='';btnActs=[];infoFns=[];   // data-act / data-info index these, per render
  if(t==='code')html=codePane();
  else if(t==='view')html=layersPane();
  else if(t==='sym')html=symPane();
  else if(t==='exp')html=expPane();
  else{
    if(t==='mis')html+=`<div id="fsm-wrap" class="fsm-wrap">${fsmSVG()}</div>`;
    for(const f of SCHEMA[t]){if(f.show&&!f.show())continue;html+=fieldHTML(f);}
    if(NOTES[t])html+=`<details class="how" ${howOpen[t]?'open':''} data-how="${t}"><summary>How it works</summary><div class="how-body">${NOTES[t]}<button class="linkbtn" data-sym="${t}">Symbol definitions for this section</button>${t==='ctl'?'<button class="linkbtn" data-sym="mpc">MPC symbols</button>':''}${t==='per'||t==='ctl'?'<button class="linkbtn" data-sym="ag">Moving-agent symbols</button>':''}${SRC_FILES[t]?`<button class="linkbtn" data-source="${SRC_FILES[t][0]}">View the source</button>`:''}</div></details>`;
  }
  $('#panes').innerHTML=`<div class="pane" id="pane" role="tabpanel">${html}</div>`;
  wirePane(t);
}
let btnActs=[],infoFns=[];
/* ---------- the beacon sensor explained, with a live line per beacon ---------- */
let bsOpen=false,bsKey='';
const BS_WHY={ok:['reading','ok'],range:['out of range','muted'],blocked:['blocked (no line of sight)','warn'],off:['switched off','muted'],outage:['in an outage','warn']};
function beaconSensorHTML(){
  const k=P.lmK,sr=0.08*k,sb=0.03*k,R=P.lmRange,r=S.robot,u=beaconUse();
  const rows=S.beacons.map(b=>{const d=hyp(b.x-r.x,b.y-r.y),w=(S.bWhy&&S.bWhy[b.id])||(beaconsOff().has(b.id)?'off':d>R?'range':''),W=S.bSeen?S.bSeen[b.id]:[],
    rate=S.t>0.2?W.filter(t=>t>S.t-5).length/Math.min(5,S.t):0,st=BS_WHY[w]||['no scan yet','muted'];
    return`<tr><td>${b.id}</td><td>${d.toFixed(1)} m</td><td class="bs-${st[1]}">${st[0]}</td><td>${rate.toFixed(1)}/s</td><td>${(d*sb).toFixed(2)} m</td></tr>`;}).join('');
  return`<p>Each beacon is a fixed landmark at a known position (teal diamond on the map). The robot's beacon sensor takes one <b>scan every 0.2 s (5 Hz)</b> and in each scan reads every beacon that is</p>
<ul class="bs-list"><li>switched on and not in an outage,</li><li>between <b>0.2 m and ${R} m</b> away (the sensor range: Beacon sensor range, below),</li><li>in <b>line of sight</b>: a wall, shelf, parked car or person on the straight line to the beacon blocks it completely. There is no partial or weakened signal.</li></ul>
<p>A reading is a <b>range</b> r and a <b>bearing</b> b (relative to the robot's heading) with Gaussian noise: <b>σ<sub>r</sub> = ${sr.toFixed(3)} m</b> and <b>σ<sub>b</sub> = ${sb.toFixed(3)} rad (${deg(sb).toFixed(1)}°)</b>, which is 0.08 m and 0.03 rad × the noise scale ${k.toFixed(1)} (Vehicle → Beacon range/bearing noise). The noise does <b>not</b> grow with distance, but a bearing error moves the implied position sideways by d·σ<sub>b</sub>, so a far beacon pins the position less (last column). The EKF and the particle filter assume these same σ's.</p>
<p>Also in play: Sensor latency (Vehicle) delivers readings late; Unlabeled association (above) drops the IDs and adds false detections; Random outages (below) switch beacons off for a while.${u?` <b>Right now ${u}.</b>`:''}</p>
<table class="bs-tab"><thead><tr><th>#</th><th>distance</th><th>this scan</th><th title="Readings received per second over the last 5 s (at most 5)">readings</th><th title="Sideways position error of one bearing reading, d·σ_b">d·σ<sub>b</sub></th></tr></thead><tbody>${rows}</tbody></table>`;
}
function renderBeaconSensor(){
  const el=$('#bsens-body');if(!el||!bsOpen)return;
  const key=Math.round(S.t*5)+'|'+P.lmK+P.lmRange+P.bOff+P.loc+P.pfLidar;if(key===bsKey)return;bsKey=key;el.innerHTML=beaconSensorHTML();
}
const TIPS={loc:'Which estimator produces the pose the planner and controller use.',assoc:'Whether beacon readings carry their ID. Unlabeled readings are matched by Mahalanobis distance.',npart:'More particles cost CPU and resolve the belief more finely.',inject:'Replace low-weight particles with poses sampled from beacon readings when the likelihood drops.',pfLidar:'Score particles against the prior map with 24 lidar beams.',filtK:'Motion noise the filter assumes: the same σ_v, σ_ω model as the odometry with k_filter = this × max(odometry noise, 0.25), and never the calibration bias; too low makes it overconfident (NEES above 3).',
 per:'Prior map: the planner sees the true static map. Lidar mapping: an occupancy grid built from scans in the estimated frame.',unknownAs:'Whether unobserved cells block the planner.',infl:'Width of the soft cost band outside the lethal radius.',agents:'Off: people reach the stack only as lidar hits. Ground truth: perfect tracks. Lidar: clustering plus a Kalman filter per agent.',agPred:'Constant velocity extrapolates each track; Static freezes it where it is now.',agT:'How far ahead agents are predicted and the speed planner plans.',agGrow:'How fast the predicted radius grows per second of prediction.',agSigA:'White acceleration noise of the constant-velocity model. Higher follows turns faster but gives noisier velocity.',
 mis:'In order visits goals as numbered. Greedy picks the nearest next. Optimal solves the open-path TSP.',replan:'Replan on a timer in addition to the event-driven triggers.',lostGuard:'Stop when the position uncertainty exceeds 1 m.',
 plan:'Global planner on the costmap. Reeds–Shepp and Hybrid A* are car-only.',planPct:'Fraction of the steering limit the planner may use. The rest is margin for the tracker.',eps:'Heuristic weight. Above 1 the search is faster and the path up to ε times longer.',hybH:'Which heuristic guides Hybrid A*.',revOK:'Allow reverse legs with cusps.',revPen:'Cost multiplier on reverse distance.',gearPen:'Fixed cost for each change of direction.',rrtIt:'Samples per RRT* run.',smooth:'Shortcut the path with line-of-sight checks.',agPlan:'When the speed planner cannot avoid an agent, replan around its predicted positions.',
 ctl:'Path tracker that turns the plan into speed and steering.',vcruise:'Speed the reference profile aims for on straights.',spd:'How path trackers and MPC react to tracked agents. Ignore: not at all. Reactive stop: brake for hits in the corridor ahead (path trackers). Speed planning: ST-graph speed profile against the predictions; it caps a path tracker\'s speed and is MPC\'s reference.',stMarg:'Clearance the speed planner keeps from predicted agents.',ppL0:'Lookahead distance at zero speed.',ppK:'Extra lookahead per m/s of speed.',alat:'Lateral acceleration cap that slows the robot in curves.',rwKth:'Heading-error gain of rear-wheel feedback. Higher damps more.',rwKe:'Lateral-error gain of rear-wheel feedback. Higher is stiffer.',stanK:'Stanley cross-track gain.',kp:'Proportional gain on heading error to the carrot.',ki:'Integral gain; removes steady error but adds phase lag.',kd:'Derivative gain on heading error.',dwaG:'DWA weight on distance and heading to the carrot.',dwaO:'DWA weight on clearance.',dwaV:'DWA weight on speed.',dwaT:'How far DWA rolls each candidate out.',
 mpcMode:'NMPC relinearizes every iteration; LTV linearizes once about the reference.',mpcNp:'Prediction horizon in steps of Δt.',mpcNc:'Free input moves; later moves are held at the last one.',mpcDt:'Prediction step.',mpcIt:'SQP iterations per 50 ms tick, within a 15 ms budget.',mpcQlat:'Penalty on lateral error.',mpcQlon:'Penalty on along-track error.',mpcQth:'Penalty on heading error.',mpcQv:'Penalty on speed error.',mpcQf:'Multiplier on the last step of the horizon.',mpcRa:'Penalty on acceleration input.',mpcRs:'Penalty on steering-rate or angular-acceleration input.',mpcRd:'Penalty on the change between consecutive moves.',mpcRho:'Augmented-Lagrangian penalty for the state constraints.',mpcObs:'Add clearance constraints against lidar points and predicted agents.',mpcMarg:'Extra clearance in the obstacle constraints.',mpcLag:'Model the first-order actuator lag with two more states.',
 model:'Unicycle turns in place; the bicycle model steers front wheels and needs motion to turn.',veh:'Unicycle turns in place. The kinematic car goes exactly where its front wheel points. The dynamic car has mass, yaw inertia and tyres that slip, so it turns less than it steers and can run out of grip.',
 mass:'Mass of the car with tyre slip; with the cornering stiffnesses it sets how much the tyres slip in a turn.',Iz:'Yaw moment of inertia about the centre of mass; larger is slower to start and stop turning.',lf:'Distance from the front axle back to the centre of mass; l_r = L − l_f. A centre of mass nearer the front loads the front tyres.',Cf:'Sideways force per radian of front slip angle (both front tyres). Softer front tyres understeer more.',Cr:'Sideways force per radian of rear slip angle (both rear tyres). Softer rear tyres move the car toward oversteer.',mu:'Friction coefficient: a tyre pushes sideways with at most μ times its load, so the car can corner at about μg.',gyro:'Report the true yaw rate in the odometry instead of v tan δ / L from the steering encoder.',wheelbase:'Distance between axles.',steerMaxDeg:'Steering limit; sets the minimum turning radius.',steerRate:'How fast the steering angle can change.',vmax:'Speed limit.',wmax:'Turn-rate limit of the unicycle.',accel:'Enforce acceleration limits in the vehicle.',amax:'Linear acceleration limit.',alpha:'Angular acceleration limit.',lag:'First-order actuator time constant.',latency:'Ticks a command waits before reaching the actuators.',biasDeg:'Constant offset between commanded and actual steering angle.',biasW:'Constant offset in turn rate, as from one weak motor.',odoK:'Random odometry error, drawn fresh every 50 ms: σ_v = k (0.1|v| + 0.02) m/s on speed and σ_ω = k (0.2|ω| + 0.1|v| + 0.02) rad/s on turn rate, so ×1 at 0.8 m/s straight is σ 0.10 m/s and 0.10 rad/s per reading.',odoB:'Fixed calibration error the filters are never told about: speed reads v (1 + 0.02 b) and turn rate ω + 0.01 b·v rad/s, so ×1 at 0.8 m/s is +1.6 cm/s and +0.008 rad/s (0.46°/s, about 28° of heading per minute).',lmK:'Beacon range and bearing noise scale.',bOff:'Beacons switched off send no readings. Also: the Beacon tool on the map (B).',bOut:'Each beacon fails at random and comes back; this is the share of time it is down. Outages have their own random stream, so the sensor noise is unchanged.',bOutLen:'Average length of one outage. A few tenths of a second is a flicker; several seconds is a dead zone.',lmRange:'Beacon sensor range.',clutter:'False beacon detections per scan in unlabeled mode.',lidarSig:'Lidar range noise.',seed:'Seed of the world and sensor noise. Applied on Reset.'};
function lvlDefault(k){if(k==='veh')return vehOf(lvlDefault('model'),lvlDefault('carPhys'));return k in (LV.cfg||{})?LV.cfg[k]:DEFAULTS[k];}
function chgMark(f){const d=lvlDefault(f.k);if(d===undefined||P[f.k]===d)return'';const o=f.opts&&(typeof f.opts==='function'?f.opts():f.opts).find(x=>x[0]===d);
  const dv=typeof d==='number'?fmtVal(f,d):typeof d==='boolean'?(d?'on':'off'):o?o[1]:d===''?'none':d;return`<button class="rst" data-reset="${f.k}" title="Back to this level's default (${dv})">↺</button>`;}
function fieldHTML(f){
  if(f.type==='head')return`<h3 class="fhead">${f.label}</h3>`;
  if(f.type==='info'){infoFns.push(f.text);return`<p class="note" data-info="${infoFns.length-1}">${f.text()}</p>`;}
  if(f.type==='seg')return`<div class="field${chgMark(f)?' chg':''}"><span class="lbl" title="${TIPS[f.k]||''}">${f.label}${chgMark(f)}</span><div class="seg" data-k="${f.k}">${(typeof f.opts==='function'?f.opts():f.opts).map(([v,l])=>`<button data-v="${v}" aria-pressed="${P[f.k]===v}">${l}</button>`).join('')}</div></div>`;
  if(f.type==='bool')return`<label class="check${chgMark(f)?' chg':''}" title="${TIPS[f.k]||''}"><input type="checkbox" id="p-${f.k}" data-k="${f.k}" ${P[f.k]?'checked':''}><span>${f.label}${chgMark(f)}</span></label>`;
  if(f.type==='beacons'){const off=beaconsOff(),c=chgMark({k:'bOff'});
    return`<div class="field${c?' chg':''}"><span class="lbl" title="${TIPS.bOff}">${f.label}${c}</span><div class="bchips">${S.beacons.map(b=>`<button data-beacon="${b.id}" aria-pressed="${!off.has(b.id)}" title="Beacon ${b.id} at ${b.x.toFixed(1)}, ${b.y.toFixed(1)} m">${b.id}</button>`).join('')}</div><div class="bchips-all"><button class="linkbtn" data-beacon="all">All on</button><button class="linkbtn" data-beacon="none">All off</button></div></div>`;}
  if(f.type==='bsensor')return`<details class="how bsens" id="bsens" ${bsOpen?'open':''}><summary>Beacon sensor: rate, range, noise, what blocks it</summary><div class="how-body" id="bsens-body">${beaconSensorHTML()}</div></details>`;
  if(f.type==='btns')return`<div class="field"><span class="lbl">${f.label}</span><div class="seg">${f.items().map(([l,act,on,tip])=>{btnActs.push(act);return`<button type="button" data-act="${btnActs.length-1}" aria-pressed="${!!on}"${tip?` title="${tip}"`:''}>${l}</button>`;}).join('')}</div></div>`;
  if(f.type==='btn'){btnActs.push(f.act);return`<div><button class="btn" data-act="${btnActs.length-1}">${f.label}</button></div>`;}
  return`<div class="field${chgMark(f)?' chg':''}"><div class="row"><label for="p-${f.k}" title="${TIPS[f.k]||''}">${f.label}${chgMark(f)}</label><output id="o-${f.k}">${fmtVal(f,P[f.k])}</output></div><input type="range" id="p-${f.k}" data-k="${f.k}" min="${f.min}" max="${typeof f.max==='function'?f.max():f.max}" step="${f.step}" value="${P[f.k]}"></div>`;
}
function fmtVal(f,v){const d=f.step<0.01?3:f.step<0.1?2:f.step<1?(f.step%0.1<1e-9?1:2):0;return`${(+v).toFixed(d)}${f.unit?' '+f.unit:''}`;}
function wirePane(t){
  const pane=$('#pane');
  pane.querySelectorAll('[data-reset]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const k=b.dataset.reset;setParam(k,lvlDefault(k),false);renderAllPanes();});
  pane.querySelectorAll('.seg[data-k]').forEach(sg=>sg.querySelectorAll('button').forEach(b=>b.onclick=()=>{setParam(sg.dataset.k,b.dataset.v);renderAllPanes();}));
  pane.querySelectorAll('input[type=checkbox][data-k]').forEach(cb=>cb.onchange=()=>{setParam(cb.dataset.k,cb.checked);renderAllPanes();});
  pane.querySelectorAll('input[type=range][data-k]').forEach(rg=>{const f=Object.values(SCHEMA).flat().find(x=>x.k===rg.dataset.k);
    rg.oninput=()=>{$('#o-'+f.k).textContent=fmtVal(f,rg.value);setParam(f.k,+rg.value,true);pane.querySelectorAll('[data-info]').forEach(el=>{el.textContent=infoFns[+el.dataset.info]();});};
    rg.onchange=()=>setParam(f.k,+rg.value,false);});
  pane.querySelectorAll('[data-beacon]').forEach(b=>b.onclick=()=>{const v=b.dataset.beacon;
    if(v==='all')setParam('bOff','',false);else if(v==='none')setParam('bOff',S.beacons.map(x=>x.id).join(','),false);else toggleBeacon(+v);renderAllPanes();});
  pane.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>btnActs[+b.dataset.act]());
  const bs=$('#bsens');if(bs)bs.ontoggle=()=>{bsOpen=bs.open;bsKey='';renderBeaconSensor();};
  pane.querySelectorAll('details[data-how]').forEach(d=>d.ontoggle=()=>{howOpen[d.dataset.how]=d.open;});
  pane.querySelectorAll('[data-sym]').forEach(b=>b.onclick=()=>showSym(b.dataset.sym));
  pane.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>showSource(b.dataset.source));
  if(t==='code')wireCode();
  if(t==='exp')wireExp(pane);
  if(t==='sym')wireSym(pane);
  if(t==='view'){const g=$('#ghost-clear');if(g)g.onclick=()=>forgetGhost();}
  if(t==='view'){pane.querySelectorAll('input[data-layer]').forEach(cb=>cb.onchange=()=>{LAYERS[cb.dataset.layer]=cb.checked;renderGhostChip();const fresh=!layersEdited;layersEdited=true;if(fresh)renderAllPanes();draw();});
    const au=$('#layers-auto');if(au)au.onclick=()=>{layersEdited=false;layersKey='';renderAllPanes();};}
}
let replanDebounce=null;


// Nomenclature, IEEE style: symbol — definition [unit], grouped by subsystem
const I=s=>`<i>${s}</i>`;
