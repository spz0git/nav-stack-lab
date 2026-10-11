# ---- patch 26: moving agents — tracking, prediction, ST speed planning, predictive DWA/MPC, people in the parking lot ----
AGJS=open('ag/agents.js').read()
rep("function preControl(){",AGJS+"\nfunction preControl(){")
rep("  metrics();\n  missionTick();\n}","  metrics();\n  missionTick();\n  agentsTick();\n}")
rep("      applyCmd(normCmd(cmd));\n","      applyCmd(normCmd(cmd));\n      agPost();\n")
rep("  return c;}\nfunction builtinRaw(){","  return agSpeedCap(c);}\nfunction builtinRaw(){")
rep("    rejected:0,customMark:null,\n","    rejected:0,customMark:null,agents:agInit(),collPedStill:0,minPed:Infinity,\n")
# people may pause at the ends of their walk (prediction error when they stop and when they set off again)
rep("""    p.s+=p.dir*p.v*dt/L; if(p.s>1){p.s=2-p.s;p.dir=-1;} if(p.s<0){p.s=-p.s;p.dir=1;}
    p.x=p.a[0]+(p.b[0]-p.a[0])*p.s; p.y=p.a[1]+(p.b[1]-p.a[1])*p.s;
    p.vx=p.dir*p.v*(p.b[0]-p.a[0])/L; p.vy=p.dir*p.v*(p.b[1]-p.a[1])/L;""",
"""    if(p.dw){if(p.wait>0)p.wait-=dt;else{p.s+=p.dir*p.v*dt/L;if(p.s>=1){p.s=1;p.dir=-1;p.wait=p.dw;}if(p.s<=0){p.s=0;p.dir=1;p.wait=p.dw;}}}
    else{p.s+=p.dir*p.v*dt/L; if(p.s>1){p.s=2-p.s;p.dir=-1;} if(p.s<0){p.s=-p.s;p.dir=1;}}
    p.x=p.a[0]+(p.b[0]-p.a[0])*p.s; p.y=p.a[1]+(p.b[1]-p.a[1])*p.s;
    const mv=!(p.wait>0);p.vx=mv?p.dir*p.v*(p.b[0]-p.a[0])/L:0; p.vy=mv?p.dir*p.v*(p.b[1]-p.a[1])/L:0;""")
rep("  if(pc&&!r.pedContact){S.collPed++;logE('Contact with a person','bad');}",
    "  if(S.peds.length){let g=Infinity;for(const p of S.peds)g=Math.min(g,bodyGap(r,p));if(g<S.minPed)S.minPed=g;}\n"
    "  if(pc&&!r.pedContact){S.collPed++;const still=Math.abs(r.v)<0.05;if(still)S.collPedStill=(S.collPedStill||0)+1;logE(still?'A person walked into the stopped robot':'Contact with a person','bad');}")
rep("lidarSig:0.02,seed:7};","lidarSig:0.02,seed:7,agents:'off',agPred:'cv',agT:4,agGrow:0.1,agSigA:0.8,spd:'none',stMarg:0.3,agPlan:true};")
# ---- L5 ----
rep("""  adds:'Prior map, but people walk the aisles. Acceleration limits and actuator lag are on, and beacons are unlabeled with false detections.',
  tries:['<b>Control:</b> pure pursuit follows the path into people. Switch to DWA and compare collision counts.',
         '<b>Control:</b> tune DWA clearance weight. Too low clips people, too high stalls in narrow aisles.',""",
"""  adds:'Prior map, but people walk the aisles. A lidar tracker estimates where they are and how fast they move, and a speed planner predicts where they will be. Acceleration limits and actuator lag are on, and beacons are unlabeled with false detections.',
  tries:['<b>Control:</b> pure pursuit runs with Moving agents set to Speed planning: it keeps its path and slows or waits for people predicted to cross it. Open the ST graph in Telemetry. Then set it to Ignore, then Reactive stop, and compare people contacts.',
         '<b>Perceive:</b> set Prediction to Static (frozen). The planner then reacts only to where people are now, and the robot pulls into gaps that are about to close.',
         '<b>Perceive:</b> switch Moving agents from Lidar tracker to Ground truth. The difference is what tracking costs: late confirmation, noisy velocity, coasting through occlusion.',
         '<b>Control:</b> DWA and MPC use the predictions too, as time-indexed obstacles. Compare them with Moving agents set to Not tracked, which treats every lidar hit as a static obstacle at the moment of the scan.',""")
rep("clutter:0.5,replan:2,lostGuard:true},layers:{cost:false}},","clutter:0.5,replan:2,lostGuard:true,agents:'lidar',spd:'st'},layers:{cost:false}},")
# ---- L6: people in the lanes ----
rep("Goals now carry a heading: reverse into a bay, nose into another, then parallel park.',",
    "Goals now carry a heading: reverse into a bay, nose into another, then parallel park. People cross the lanes on their way to and from cars, pausing before they turn back.',")
rep("""         '<b>Control:</b> MPC knows the steering-rate limit, so it needs no dry-steering rule at cusps. Switch it to LTV and watch the dashed linear prediction drift from the true one at the start of each leg.'],""",
"""         '<b>Control:</b> MPC knows the steering-rate limit, so it needs no dry-steering rule at cusps. Switch it to LTV and watch the dashed linear prediction drift from the true one at the start of each leg.',
         '<b>Control:</b> people cross the lanes. With Moving agents set to Speed planning the car keeps its manoeuvre and picks a speed that lets them pass; the ST graph in Telemetry shows why. Set it to Ignore and count contacts, then Reactive stop.',
         '<b>Perceive:</b> set Prediction to Static (frozen), or the horizon to 1 s. The car stops treating crossing people as future obstacles and noses into their way.'],""")
rep("[9,4.98],[17,4.98]],peds:[],","[9,4.98],[17,4.98]],\n  peds:[{a:[0.8,10.2],b:[3.3,10.2],v:0.5,s0:0.15,dw:3},{a:[14.8,11.2],b:[14.8,14.3],v:0.5,s0:0.18,dw:2},{a:[4.5,6.6],b:[19,6.6],v:0.7,s0:0.95,dw:1},{a:[11,1.5],b:[11,7.7],v:0.5,s0:0.48,dw:2}],")
rep("replan:0,vcruise:0.6,ppL0:0.4,ppK:0.3},layers:{cost:false}},","replan:0,vcruise:0.6,ppL0:0.4,ppK:0.3,agents:'lidar',spd:'st'},layers:{cost:false}},")
# ---- MPC: time-indexed agent constraints; agent hits leave the static point set ----
rep("  const nc=4+(obs?offs.length:0);\n  const pts=obs?S.scanPts.filter(",
    "  const agM=obs&&agOn(),nc=4+(obs?offs.length*(agM?2:1):0),ags=agM?agList(Np*dt*Math.max(vMax,0.3)+4):[];\n  const pts=obs?((S.agents&&S.agents.staticPts)||S.scanPts).filter(")
rep("""        out.push([rc+P.mpcMarg-d,[-ux,-uy,-(ux*(-o*sn)+uy*(o*c)),0,0]]);}}
    return out;};""",
"""        out.push([rc+P.mpcMarg-d,[-ux,-uy,-(ux*(-o*sn)+uy*(o*c)),0,0]]);}
      if(agM){const Q=ags.map(a=>agPred(a,k*dt));   // predicted agents at this step's time
        for(const o of offs){const cx=x[0]+o*c,cy=x[1]+o*sn;let bd=Infinity,bq=null;
          for(const q of Q){const d=hyp(q[0]-cx,q[1]-cy)-q[2];if(d<bd){bd=d;bq=q;}}
          if(!bq){out.push([-1,[0,0,0,0,0]]);continue;}
          const d=Math.max(hyp(cx-bq[0],cy-bq[1]),1e-6),ux=(cx-bq[0])/d,uy=(cy-bq[1])/d;
          out.push([rc+bq[2]+P.mpcMarg-d,[-ux,-uy,-(ux*(-o*sn)+uy*(o*c)),0,0]]);}}}
    return out;};""")
# ---- DWA: rollouts checked against agents at the same time step ----
rep("  const pts=S.scanPts.filter(p=>hyp(p[0]-e.x,p[1]-e.y)<4.5);",
    "  const pts=((S.agents&&S.agents.staticPts)||S.scanPts).filter(p=>hyp(p[0]-e.x,p[1]-e.y)<4.5),ags=agOn()?agList(4.5+P.dwaT*2.5):[];")
rep("        for(const[cx,cy,cr]of fpCircles(x,y,th))for(const p of pts){const d=hyp(p[0]-cx,p[1]-cy)-cr;if(d<clear)clear=d;}if(clear<0.05)break;}",
    "        for(const[cx,cy,cr]of fpCircles(x,y,th))for(const p of pts){const d=hyp(p[0]-cx,p[1]-cy)-cr;if(d<clear)clear=d;}\n"
    "        for(const a of ags){const q=agPred(a,(k+1)*sdt);for(const[cx,cy,cr]of fpCircles(x,y,th)){const d=hyp(q[0]-cx,q[1]-cy)-cr-q[2];if(d<clear)clear=d;}}\n"
    "        if(clear<0.05)break;}")
# ---- global planner: agent layer only when the speed planner escalates ----
rep("  const wp=WPS[F.queue[0]],e=S.est,t0=performance.now();let res;",
    "  const agL=reason==='agent blocking'&&agCostLayer();   // predicted agents enter the costmap for this plan only\n  const wp=WPS[F.queue[0]],e=S.est,t0=performance.now();let res;")
rep("  const ms=performance.now()-t0;F.lastPlanT=S.t;","  const ms=performance.now()-t0;F.lastPlanT=S.t;if(agL)buildCostmap();")
# ---- schema ----
rep("""      {type:'btn',label:'Clear built map',act:()=>{S.lo.fill(0);buildCostmap();dirty.occ=true;logE('Occupancy grid cleared','warn');draw();},show:()=>P.per==='mapping'}],""",
"""      {type:'btn',label:'Clear built map',act:()=>{S.lo.fill(0);buildCostmap();dirty.occ=true;logE('Occupancy grid cleared','warn');draw();},show:()=>P.per==='mapping'},
      {k:'agents',type:'seg',label:'Moving agents',opts:[['off','Not tracked'],['truth','Ground truth'],['lidar','Lidar tracker']]},
      {k:'agPred',type:'seg',label:'Prediction',opts:[['cv','Constant velocity'],['static','Static (frozen)']],show:agOn},
      {k:'agT',label:'Prediction horizon T_p',min:1,max:6,step:0.5,unit:'s',show:agOn},
      {k:'agGrow',label:'Prediction uncertainty growth g',min:0,max:0.5,step:0.05,unit:'m/s',show:()=>agOn()&&P.agPred==='cv'},
      {k:'agSigA',label:'Tracker process noise σ_a',min:0.1,max:3,step:0.1,unit:'m/s²',show:()=>P.agents==='lidar'}],""")
rep("""      {k:'vcruise',label:'Cruise speed (reference profile)',min:0.2,max:2,step:0.05,unit:'m/s',show:()=>P.ctl!=='custom'},""",
"""      {k:'vcruise',label:'Cruise speed (reference profile)',min:0.2,max:2,step:0.05,unit:'m/s',show:()=>P.ctl!=='custom'},
      {k:'spd',type:'seg',label:'Moving agents',opts:[['none','Ignore'],['stop','Reactive stop'],['st','Speed planning (ST graph)']],show:()=>AG_PATH_CTL.includes(P.ctl)},
      {type:'info',text:()=>'Speed planning needs agent tracking: Perceive → Moving agents.',show:()=>AG_PATH_CTL.includes(P.ctl)&&P.spd==='st'&&!agOn()},
      {k:'stMarg',label:'Clearance kept from predicted agents',min:0,max:1,step:0.05,unit:'m',show:()=>AG_PATH_CTL.includes(P.ctl)&&P.spd==='st'&&agOn()},
      {type:'info',text:()=>P.ctl==='mpc'?'MPC adds a clearance constraint per footprint circle and step against the nearest predicted agent (NMPC with obstacle constraints).':'DWA checks each rollout against the agents\\' predicted positions at the same time step.',show:()=>(P.ctl==='dwa'||P.ctl==='mpc')&&agOn()},""")
rep("""       {type:'btn',label:'Replan now',act:()=>""","""       {k:'agPlan',type:'bool',label:'When the speed planner reports an agent blocking the path, replan around its predicted positions'},
       {type:'btn',label:'Replan now',act:()=>""")
rep("  if(k==='assoc'||k==='inject'||k==='filtK'){S.nees=[];}",
    "  if(k==='assoc'||k==='inject'||k==='filtK'){S.nees=[];}\n  if(k==='agents'){S.agents=agInit();logE(`Moving agents → ${({off:'not tracked',truth:'ground truth',lidar:'lidar tracker'})[v]}`);}\n  if(k==='spd')logE(`Agents (path trackers) → ${({none:'ignore',stop:'reactive stop',st:'speed planning'})[v]}`);")
# ---- layers + drawing ----
rep("trail:true,dwa:true};","trail:true,dwa:true,agents:true};")
rep("['dwa','Local planner: DWA rollouts, MPC prediction and reference']];","['dwa','Local planner: DWA rollouts, MPC prediction and reference'],['agents','Agent tracks, predictions, and the ego\\'s predicted positions at the same times']];")
rep("  if(S.ctlViz&&S.ctlViz.carrot){const c=S.ctlViz.carrot,",
"""  // tracked agents (estimate frame) with predicted positions, and the ego's predicted positions at the same times
  const egoM=LAYERS.agents&&S.agents&&agOn()?agEgoMarks():[];
  if(LAYERS.agents&&S.agents&&agOn()){
    for(const t of S.agents.tracks){
      if(!t.conf){ctx.strokeStyle=rgba(TOK.muted,0.8);ctx.lineWidth=px(1);ctx.setLineDash([px(2),px(2)]);ctx.beginPath();ctx.arc(t.x,t.y,t.r,0,TAU);ctx.stroke();ctx.setLineDash([]);continue;}
      const f=agPred(t,P.agT);ctx.strokeStyle=rgba(TOK.warn,0.75);ctx.lineWidth=px(1.2);ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(f[0],f[1]);ctx.stroke();
      ctx.setLineDash([px(3),px(3)]);for(let k=1;k<=P.agT+1e-6;k++){const q=agPred(t,k);ctx.strokeStyle=rgba(TOK.warn,Math.max(0.15,0.6-0.1*k));ctx.beginPath();ctx.arc(q[0],q[1],q[2],0,TAU);ctx.stroke();}ctx.setLineDash([]);
      ctx.strokeStyle=TOK.warn;ctx.lineWidth=px(2);ctx.beginPath();ctx.arc(t.x,t.y,t.r,0,TAU);ctx.stroke();}
    for(const m of egoM){ctx.strokeStyle=TOK.accent;ctx.lineWidth=px(1.5);ctx.fillStyle=TOK['map-bg'];ctx.beginPath();ctx.arc(m[0],m[1],px(7),0,TAU);ctx.fill();ctx.stroke();}
  }
  if(S.ctlViz&&S.ctlViz.carrot){const c=S.ctlViz.carrot,""")
rep("  WPS.forEach((w,i)=>{if(w.done)return;const q=order.indexOf(i);const[sx,sy]=toS(w.x,w.y);",
"""  if(LAYERS.agents&&S.agents&&agOn()){ctx.font=`600 ${Math.round(9*dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono')||'monospace'}`;
    for(const t of S.agents.tracks){if(!t.conf)continue;const[sx,sy]=toS(t.x+t.r*0.75,t.y+t.r*0.75);ctx.fillStyle=TOK.warn;ctx.textAlign='left';ctx.textBaseline='bottom';ctx.fillText('#'+t.id,sx+2*dpr,sy);
      ctx.textAlign='center';ctx.textBaseline='middle';for(let k=1;k<=P.agT+1e-6;k++){const q=agPred(t,k);if(P.agPred!=='cv')break;const[qx,qy]=toS(q[0],q[1]);ctx.fillStyle=rgba(TOK.warn,0.9);ctx.fillText(String(k),qx,qy);}}
    ctx.textAlign='center';ctx.textBaseline='middle';for(const m of egoM){const[sx,sy]=toS(m[0],m[1]);ctx.fillStyle=TOK.accent;ctx.fillText(String(m[2]),sx,sy+0.5);}
    ctx.font=`600 ${Math.round(10*dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono')||'monospace'}`;}
  WPS.forEach((w,i)=>{if(w.done)return;const q=order.indexOf(i);const[sx,sy]=toS(w.x,w.y);""")
# ---- telemetry ----
rep("function drawPlot(){\n","function drawPlot(){\n  if(plotCh==='st')return drawST();\n")
rep("[['ex','x error'],['eth','θ error'],['cte','Cross-track'],['v','Speed'],['turn','Steering']]","[['ex','x error'],['eth','θ error'],['cte','Cross-track'],['v','Speed'],['turn','Steering'],['st','ST graph']]")
rep("    ['Collisions',`${S.coll} static, ${S.collPed} people`],",
    "    ['Collisions',`${S.coll} static, ${S.collPed} people${S.collPedStill?` (${S.collPedStill} into the stopped robot)`:''}`],")
rep("  if(S.pf)items.push(['Particles',",
    "  if(S.peds.length)items.push(['Closest to a person',isFinite(S.minPed)?`${Math.max(0,S.minPed).toFixed(2)} m`:'—']);\n"
    "  if(S.agents&&agOn()){const tr=S.agents.tracks,cf=tr.filter(t=>t.conf).length;items.push(['Agent tracks',`${cf} confirmed · ${tr.length-cf} tentative`]);}\n"
    "  if(S.pf)items.push(['Particles',")
# ---- notes ----
rep("""occupied if l > 0.5;  unknown if l ≈ 0</div>""","""occupied if l > 0.5;  unknown if l ≈ 0</div>""")
rep("""a quadratic penalty fades out across the inflation band.</p>`,""","""a quadratic penalty fades out across the inflation band.</p>
<p><b>Moving agents.</b> The lidar tracker takes the hits the static map does not explain (prior map: more than 0.25 m from it; built map: cells that are not persistently occupied) and clusters them over consecutive beams. Clusters wider than 1.2 m are dropped as map error. Hits lie on the near side of a person, so the centre is pushed 0.6 r away from the sensor.</p>
<div class="eq">state  x = [p_x, p_y, v_x, v_y],  constant-velocity model
x' = F x,  F = [I  Δt·I; 0  I],  Q from white acceleration noise σ_a
z = p + noise (σ_z = 0.1 m);  gate d² = ‖z − p̂‖² / (P_pp + σ_z²) < 9.21  (χ²₂, 99 %)
greedy nearest-neighbour assignment · confirm after 3 hits · coast up to 1 s unseen
prediction  p(t) = p + v t,   r(t) = r + g t</div>
<p><b>Ground truth</b> hands over true positions and velocities, which separates prediction error from tracking error. Hits that belong to confirmed tracks are taken out of the static obstacle set the local planners see; the predictions replace them. People do not react to the robot, so this is prediction without interaction.</p>`,""")
rep("""<p>It treats people as static at the moment of the scan. Predicting their motion is the next level up (velocity obstacles, MPC).</p>""",
"""<p>Without agent tracking DWA treats people as static at the moment of the scan. With tracking on, each rollout is checked against the agents' predicted positions at the same time step. MPC gets one clearance constraint per footprint circle and prediction step against the nearest predicted agent.</p>""")
rep("""Stanley's reference point would trail on a reverse leg, so reverse legs fall back to pure pursuit. A leg ends within 0.12 m of its cusp. The built-in car controllers hold speed until the wheels reach the commanded angle (dry steering), and reverse legs are capped at 0.35 m/s.</p>`,""",
"""Stanley's reference point would trail on a reverse leg, so reverse legs fall back to pure pursuit. A leg ends within 0.12 m of its cusp. The built-in car controllers hold speed until the wheels reach the commanded angle (dry steering), and reverse legs are capped at 0.35 m/s.</p>
<p><b>Moving agents with a path tracker: speed planning.</b> Pure pursuit, rear-wheel feedback, Stanley and PID only steer. To handle people the stack splits the problem (path–velocity decomposition): keep the path, choose the speed. The ST graph (Telemetry) has distance s ahead on the path against time t. A cell is blocked when the footprint at s overlaps a predicted agent at t, plus the clearance. Dynamic programming over (t, s, v) picks the profile:</p>
<div class="eq">v' = v + a Δt,   a ∈ {−b, −b/2, −b/5, 0, a_c/2, a_c},   Δt = 0.2 s, horizon T_p
J = Σ Δt [ (v_ref(s) − v)² + 0.3 a² + 3 · proximity ],   blocked cells forbidden
the speed at t = 0.2 s caps the tracker's speed; the commanded curvature is kept</div>
<p>a_c and b are the acceleration limit when limits are on, otherwise 0.8 and 1.5 m/s². If no profile avoids the agents the robot brakes. If that lasts about 1 s, or it has waited about 4 s, the behaviour layer asks the global planner for a path around the agents' predicted positions. <b>Reactive stop</b> is the baseline without tracking or prediction: brake for any unexplained lidar hit in the footprint corridor ahead.</p>`,""")
rep("""h  = ε · max(2D Dijkstra with obstacles, Reeds–Shepp without obstacles)""","""h  = ε · max(2D Dijkstra with obstacles, Reeds–Shepp without obstacles)""")
rep("""<p>To give a goal a heading, use <b>Tap map to → Add posed goal</b> and drag in the direction the car should face. Goals without a heading are accepted at any heading.</p>`,""",
"""<p>To give a goal a heading, use <b>Tap map to → Add posed goal</b> and drag in the direction the car should face. Goals without a heading are accepted at any heading.</p>
<p><b>Moving agents.</b> The global plan ignores them on purpose: people move faster than a global plan stays valid, and the speed planner handles them. Only when it reports an agent blocking the path does the replan add that agent's predicted positions over the next 2 s to the costmap, for that one plan.</p>`,""")
rep("DRIVE → PLAN on: path blocked in costmap · stuck (&lt;0.15 m in 5 s,","DRIVE → PLAN on: path blocked in costmap · agent blocking (speed planner) · stuck (&lt;0.15 m in 5 s,")
rep("""${t==='ctl'?'<button class="linkbtn" data-sym="mpc">MPC symbols</button>':''}""","""${t==='ctl'?'<button class="linkbtn" data-sym="mpc">MPC symbols</button>':''}${t==='per'||t==='ctl'?'<button class="linkbtn" data-sym="ag">Moving-agent symbols</button>':''}""")
# ---- nomenclature ----
rep(""" {id:'tele',title:'Telemetry',rows:[""",""" {id:'ag',title:'Moving agents and prediction',rows:[
  [`<b>x</b><sub>a</sub>`,`Agent track state [${I('p')}<sub>x</sub>, ${I('p')}<sub>y</sub>, ${I('v')}<sub>x</sub>, ${I('v')}<sub>y</sub>]`,'m, m/s'],
  [I('F'),'Constant-velocity state transition',''],
  ['σ<sub>a</sub>','Tracker process noise: white acceleration of the constant-velocity model','m/s²'],
  ['σ<sub>z</sub>','Noise of a detected agent position, 0.1 m','m'],
  [`${I('d')}²`,'Mahalanobis distance that gates track–detection pairs (χ²₂ 99 %: 9.21)',''],
  [`${I('T')}<sub>p</sub>`,'Prediction horizon','s'],
  [`${I('r')}(${I('t')})`,`Predicted agent radius ${I('r')} + ${I('g')}·${I('t')}`,'m'],
  [I('g'),'Uncertainty growth of the prediction','m/s'],
  [I('s'),'In the ST graph only: distance ahead along the current path leg','m'],
  [`${I('v')}<sub>ref</sub>(${I('s')})`,'Speed the tracker would use at s: cruise, curvature and stopping limits','m/s'],
  [`${I('a')}<sub>c</sub>, ${I('b')}`,'Acceleration and braking used by the speed planner','m/s²']]},
 {id:'tele',title:'Telemetry',rows:[""")
rep("""  ['<i class="swatch" style="background:var(--warn)"></i>','People, with a velocity tick',''],""",
"""  ['<i class="swatch" style="background:var(--warn)"></i>','People (ground truth), with a velocity tick',''],
  ['<i class="swatch ring" style="border-color:var(--warn)"></i>','Tracked agent with its ID, as estimated; dashed rings are its predicted positions at 1 s, 2 s, … growing with uncertainty. Grey dashed ring: tentative track',''],
  ['<i class="swatch ring" style="border-color:var(--accent)"></i>','Ego predicted positions at 1 s, 2 s, … from the speed plan, MPC or DWA. Matching numbers on the agents\\' rings are the same instants',''],""")
# ---- custom controller sees the tracks ----
rep("goal:{x:wp.x,y:wp.y},scan:S.scanPts,","goal:{x:wp.x,y:wp.y},scan:S.scanPts,agents:agList().map(t=>({id:t.id,x:t.x,y:t.y,vx:t.vx,vy:t.vy,r:t.r})),")
rep("// obs.scan   [[x, y], ...]   lidar hits in the world frame (from the estimate)\n","// obs.scan   [[x, y], ...]   lidar hits in the world frame (from the estimate)\n// obs.agents [{id, x, y, vx, vy, r}]  tracked moving agents (Perceive → Moving agents)\n")
