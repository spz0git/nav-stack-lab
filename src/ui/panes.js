
let tryOpen=false;   // the Try list starts collapsed so the map and telemetry fit on screen
function buildLevels(){
  $('#levels').innerHTML=LEVELS.map((L,i)=>`<button class="lvl" data-i="${i}" aria-pressed="${L===LV}" title="${L.id} ${L.name}">${L.id}</button>`).join('');
  $('#levels').querySelectorAll('.lvl').forEach(b=>b.onclick=()=>loadLevel(+b.dataset.i));
  $('#brief').innerHTML=`<div><h3>What ${LV.id} <span class="lvname">${LV.name}</span> adds</h3><p class="adds">${LV.adds}</p></div><details class="try" ${tryOpen?'open':''}><summary><h3>Try (${LV.tries.length}) · each button sets the lab up and runs</h3></summary><ul>${LV.tries.map((t,i)=>`<li>${t.t}<div class="tries">${t.b.map((x,j)=>`<button class="btn small" data-lt="${i}:${j}">${x[0]}</button>`).join('')}</div></li>`).join('')}</ul></details>`;
  $('#brief .try').ontoggle=e=>{tryOpen=e.target.open;};
  $('#brief').querySelectorAll('[data-lt]').forEach(b=>b.onclick=()=>{const[i,j]=b.dataset.lt.split(':').map(Number);tryGo(LV.tries[i].b[j][1]);});
}
async function tryGo(cfg){
  firstRunDone();
  if(cfg.seed==='next')P.seed=P.seed%99+1;
  if(cfg.level!=null)LV=LEVELS[cfg.level];
  if(!cfg.keep)loadLevel(LEVELS.indexOf(LV));
  for(const[k,v]of Object.entries(cfg.set||{}))setParam(k,v,false);
  if(cfg.layers)Object.assign(LAYERS,cfg.layers);
  if(cfg.tab){activeTab=cfg.tab;consoleOpen=true;buildTabs();}renderAllPanes();
  if(cfg.plot){plotCh=cfg.plot;seg($('#plotsel'),PLOT_OPTS,()=>plotCh,v=>{plotCh=v;drawPlot();});}
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
  $('#tabs').innerHTML=TABS.filter(t=>G.tabs.includes(t.id)).map(t=>`<button class="tab" role="tab" id="tab-${t.id}" aria-selected="${t.id===activeTab}" aria-controls="pane">${t.n?`<small>${t.n}</small>`:''}${t.name}</button>`).join('');
  $('#tabs').querySelectorAll('.tab').forEach(b=>b.onclick=()=>{const id=b.id.slice(4);
    if(id===activeTab&&consoleOpen&&narrowUI()){consoleOpen=false;buildTabs();return;}
    activeTab=id;consoleOpen=true;buildTabs();renderAllPanes();});
  $('.console').classList.toggle('collapsed',!consoleOpen);
}
function renderAllPanes(){
  const t=activeTab;let html='';
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
const TIPS={loc:'Which estimator produces the pose the planner and controller use.',assoc:'Whether beacon readings carry their ID. Unlabeled readings are matched by Mahalanobis distance.',npart:'More particles cost CPU and resolve the belief more finely.',inject:'Replace low-weight particles with poses sampled from beacon readings when the likelihood drops.',pfLidar:'Score particles against the prior map with 24 lidar beams.',filtK:'Motion noise the filter assumes, relative to the true noise. Too low makes it overconfident (NEES above 3).',
 per:'Prior map: the planner sees the true static map. Lidar mapping: an occupancy grid built from scans in the estimated frame.',unknownAs:'Whether unobserved cells block the planner.',infl:'Width of the soft cost band outside the lethal radius.',agents:'Off: people reach the stack only as lidar hits. Ground truth: perfect tracks. Lidar: clustering plus a Kalman filter per agent.',agPred:'Constant velocity extrapolates each track; Static freezes it where it is now.',agT:'How far ahead agents are predicted and the speed planner plans.',agGrow:'How fast the predicted radius grows per second of prediction.',agSigA:'White acceleration noise of the constant-velocity model. Higher follows turns faster but gives noisier velocity.',
 mis:'In order visits goals as numbered. Greedy picks the nearest next. Optimal solves the open-path TSP.',replan:'Replan on a timer in addition to the event-driven triggers.',lostGuard:'Stop when the position uncertainty exceeds 1 m.',
 plan:'Global planner on the costmap. Reeds–Shepp and Hybrid A* are car-only.',planPct:'Fraction of the steering limit the planner may use. The rest is margin for the tracker.',eps:'Heuristic weight. Above 1 the search is faster and the path up to ε times longer.',hybH:'Which heuristic guides Hybrid A*.',revOK:'Allow reverse legs with cusps.',revPen:'Cost multiplier on reverse distance.',gearPen:'Fixed cost for each change of direction.',rrtIt:'Samples per RRT* run.',smooth:'Shortcut the path with line-of-sight checks.',agPlan:'When the speed planner cannot avoid an agent, replan around its predicted positions.',
 ctl:'Path tracker that turns the plan into speed and steering.',vcruise:'Speed the reference profile aims for on straights.',spd:'How path trackers and MPC react to tracked agents. Ignore: not at all. Reactive stop: brake for hits in the corridor ahead (path trackers). Speed planning: ST-graph speed profile against the predictions; it caps a path tracker\'s speed and is MPC\'s reference.',stMarg:'Clearance the speed planner keeps from predicted agents.',ppL0:'Lookahead distance at zero speed.',ppK:'Extra lookahead per m/s of speed.',alat:'Lateral acceleration cap that slows the robot in curves.',rwKth:'Heading-error gain of rear-wheel feedback. Higher damps more.',rwKe:'Lateral-error gain of rear-wheel feedback. Higher is stiffer.',stanK:'Stanley cross-track gain.',kp:'Proportional gain on heading error to the carrot.',ki:'Integral gain; removes steady error but adds phase lag.',kd:'Derivative gain on heading error.',dwaG:'DWA weight on distance and heading to the carrot.',dwaO:'DWA weight on clearance.',dwaV:'DWA weight on speed.',dwaT:'How far DWA rolls each candidate out.',
 mpcMode:'NMPC relinearizes every iteration; LTV linearizes once about the reference.',mpcNp:'Prediction horizon in steps of Δt.',mpcNc:'Free input moves; later moves are held at the last one.',mpcDt:'Prediction step.',mpcIt:'SQP iterations per 50 ms tick, within a 15 ms budget.',mpcQlat:'Penalty on lateral error.',mpcQlon:'Penalty on along-track error.',mpcQth:'Penalty on heading error.',mpcQv:'Penalty on speed error.',mpcQf:'Multiplier on the last step of the horizon.',mpcRa:'Penalty on acceleration input.',mpcRs:'Penalty on steering-rate or angular-acceleration input.',mpcRd:'Penalty on the change between consecutive moves.',mpcRho:'Augmented-Lagrangian penalty for the state constraints.',mpcObs:'Add clearance constraints against lidar points and predicted agents.',mpcMarg:'Extra clearance in the obstacle constraints.',mpcLag:'Model the first-order actuator lag with two more states.',
 model:'Unicycle turns in place; the bicycle model steers front wheels and needs motion to turn.',wheelbase:'Distance between axles.',steerMaxDeg:'Steering limit; sets the minimum turning radius.',steerRate:'How fast the steering angle can change.',vmax:'Speed limit.',wmax:'Turn-rate limit of the unicycle.',accel:'Enforce acceleration limits in the vehicle.',amax:'Linear acceleration limit.',alpha:'Angular acceleration limit.',lag:'First-order actuator time constant.',latency:'Ticks a command waits before reaching the actuators.',biasDeg:'Constant offset between commanded and actual steering angle.',biasW:'Constant offset in turn rate, as from one weak motor.',odoK:'Odometry noise scale.',odoB:'Odometry calibration bias the filters are not told about.',lmK:'Beacon range and bearing noise scale.',lmRange:'Beacon sensor range.',clutter:'False beacon detections per scan in unlabeled mode.',lidarSig:'Lidar range noise.',seed:'Seed of the world and sensor noise. Applied on Reset.'};
function lvlDefault(k){return k in (LV.cfg||{})?LV.cfg[k]:DEFAULTS[k];}
function chgMark(f){const d=lvlDefault(f.k);if(d===undefined||P[f.k]===d)return'';return`<button class="rst" data-reset="${f.k}" title="Back to this level's default (${fmtVal(f,d)})">↺</button>`;}
function fieldHTML(f){
  if(f.type==='info'){infoFns.push(f.text);return`<p class="note" data-info="${infoFns.length-1}">${f.text()}</p>`;}
  if(f.type==='seg')return`<div class="field${chgMark(f)?' chg':''}"><span class="lbl" title="${TIPS[f.k]||''}">${f.label}${chgMark(f)}</span><div class="seg" data-k="${f.k}">${(typeof f.opts==='function'?f.opts():f.opts).map(([v,l])=>`<button data-v="${v}" aria-pressed="${P[f.k]===v}">${l}</button>`).join('')}</div></div>`;
  if(f.type==='bool')return`<label class="check${chgMark(f)?' chg':''}" title="${TIPS[f.k]||''}"><input type="checkbox" id="p-${f.k}" data-k="${f.k}" ${P[f.k]?'checked':''}><span>${f.label}${chgMark(f)}</span></label>`;
  if(f.type==='btn'){btnActs.push(f.act);return`<div><button class="btn" data-act="${btnActs.length-1}">${f.label}</button></div>`;}
  return`<div class="field${chgMark(f)?' chg':''}"><div class="row"><label for="p-${f.k}" title="${TIPS[f.k]||''}">${f.label}${chgMark(f)}</label><output id="o-${f.k}">${fmtVal(f,P[f.k])}</output></div><input type="range" id="p-${f.k}" data-k="${f.k}" min="${f.min}" max="${f.max}" step="${f.step}" value="${P[f.k]}"></div>`;
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
  pane.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>btnActs[+b.dataset.act]());
  btnActs=btnActs.slice(-20);infoFns=infoFns.slice(-20);
  pane.querySelectorAll('details[data-how]').forEach(d=>d.ontoggle=()=>{howOpen[d.dataset.how]=d.open;});
  pane.querySelectorAll('[data-sym]').forEach(b=>b.onclick=()=>showSym(b.dataset.sym));
  pane.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>showSource(b.dataset.source));
  if(t==='code')wireCode();
  if(t==='exp')wireExp(pane);
  if(t==='sym')wireSym(pane);
  if(t==='view'){const g=$('#ghost-clear');if(g)g.onclick=()=>{GHOST=null;renderAllPanes();draw();};}
  if(t==='view')pane.querySelectorAll('input[data-layer]').forEach(cb=>cb.onchange=()=>{LAYERS[cb.dataset.layer]=cb.checked;draw();});
}
let replanDebounce=null;


// Nomenclature, IEEE style: symbol — definition [unit], grouped by subsystem
const I=s=>`<i>${s}</i>`;
