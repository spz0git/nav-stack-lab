# ---------- level L6 ----------
rep("""  cfg:{loc:'pf',per:'oracle',mis:'sequential',plan:'astar',ctl:'pp',odoK:1,odoB:0.5,accel:true,lag:0.15,assoc:'unknown',clutter:0.5,replan:2,lostGuard:true},layers:{cost:false}},
];""","""  cfg:{loc:'pf',per:'oracle',mis:'sequential',plan:'astar',ctl:'pp',odoK:1,odoB:0.5,accel:true,lag:0.15,assoc:'unknown',clutter:0.5,replan:2,lostGuard:true},layers:{cost:false}},
 {id:'L6',name:'Parking lot',
  adds:'The robot becomes a car: kinematic bicycle model, 32° steering limit, a turning radius near 1 m, and a body that cannot turn in place. Goals now carry a heading: reverse into a bay, nose into another, then parallel park.',
  tries:['<b>Plan:</b> watch Hybrid A* insert reverse legs (dashed orange). Then switch to A*: the path ignores heading and turning radius, so the car swings wide and misses the bay.',
         '<b>Plan:</b> pick Reeds–Shepp. It finds the shortest maneuver but ignores obstacles, so it drives through parked cars.',
         '<b>Plan:</b> untick Allow reversing. The reverse-in bay and the parallel slot become unreachable or far longer.',
         '<b>Plan:</b> set the heuristic to 2D only and compare expansions in the log.',
         '<b>Control:</b> Stanley versus pure pursuit on forward legs. Use the Steering plot, and lower the steering rate limit in Vehicle.',
         '<b>Localize:</b> switch to EKF and raise odometry noise. The log reports the true final pose error at every bay.'],
  shapes:PARKING,beacons:[[0.45,4],[0.45,12],[12,0.45],[12,15.55],[23.55,4],[23.55,12],[3.85,9.6],[20.15,9.6],[3.8,15.55],[20.2,15.55],[9,4.98],[17,4.98]],peds:[],
  start:[2,4,Math.PI/2],wps:[[10.5,15.35,-Math.PI/2],[15.5,8.4,Math.PI/2],[5.6,0.62,0],[2,13]],
  cfg:{model:'car',loc:'truth',per:'oracle',mis:'sequential',plan:'hybrid',ctl:'pp',odoK:0,odoB:0,accel:false,lag:0,assoc:'known',clutter:0,replan:0,vcruise:0.6,ppL0:0.4,ppK:0.3},layers:{cost:false}},
];""")
rep("const LEVELS=[","""// Parking lot: parked cars are obstacles (0.56 × 1.0 m); bays are 1 m wide
const PARKING=(()=>{const s=[...BORDER,Rc(4,9.45,16,0.3)];
  for(let bx=4;bx<20;bx++){if(bx!==10&&bx!==16)s.push(Rc(bx+0.22,14.65,0.56,1.0));
    if(bx!==7&&bx!==13)s.push(Rc(bx+0.22,9.85,0.56,1.0));
    if(bx!==15&&bx!==9)s.push(Rc(bx+0.22,8.35,0.56,1.0));}
  for(const x of[4,6.8,9.5,12.5,15.5])s.push(Rc(x,0.3,1.0,0.56));
  s.push(Ci(9,4.6,0.35),Ci(13,4.6,0.35),Ci(17,4.6,0.35),Rc(20.6,2.4,1.2,1.2));
  return s;})();
const LEVELS=[""")
rep("WPS=LV.wps.map(w=>({x:w[0],y:w[1],done:false}));","WPS=LV.wps.map(w=>({x:w[0],y:w[1],th:w.length>2?w[2]:null,done:false}));")

# ---------- schema ----------
rep(" plan:[{k:'plan',type:'seg',label:'Global planner',opts:[['straight','Straight line'],['astar','A*'],['rrtstar','RRT*']]},\n       {k:'eps',label:'Heuristic weight ε',min:1,max:5,step:0.25,show:()=>P.plan==='astar'},",
""" plan:[{k:'plan',type:'seg',label:'Global planner',opts:()=>[['straight','Straight line'],['astar','A*'],['rrtstar','RRT*'],...(isCar()?[['rs','Reeds–Shepp'],['hybrid','Hybrid A*']]:[])]},
       {type:'info',text:()=>'A* and RRT* plan for a point with clearance. They ignore the car\\'s heading, body and turning radius.',show:()=>isCar()&&(P.plan==='astar'||P.plan==='rrtstar')},
       {type:'info',text:()=>'Reeds–Shepp ignores obstacles entirely.',show:()=>P.plan==='rs'},
       {k:'eps',label:'Heuristic weight ε',min:1,max:5,step:0.25,show:()=>P.plan==='astar'||P.plan==='hybrid'},
       {k:'hybH',type:'seg',label:'Hybrid A* heuristic',opts:[['both','max(2D, Reeds–Shepp)'],['2d','2D Dijkstra only']],show:()=>P.plan==='hybrid'},
       {k:'revOK',type:'bool',label:'Allow reversing',show:()=>P.plan==='hybrid'},
       {k:'revPen',label:'Reverse cost multiplier',min:1,max:5,step:0.1,unit:'×',show:()=>P.plan==='hybrid'&&P.revOK},
       {k:'gearPen',label:'Gear-change penalty',min:0,max:10,step:0.5,unit:'m',show:()=>P.plan==='hybrid'&&P.revOK},""")
rep("{k:'smooth',type:'bool',label:'Line-of-sight shortcut smoothing',show:()=>P.plan!=='straight'},",
    "{k:'smooth',type:'bool',label:'Line-of-sight shortcut smoothing',show:()=>P.plan==='astar'||P.plan==='rrtstar'},")
rep(" ctl:[{k:'ctl',type:'seg',label:'Path tracker',opts:[['pp','Pure pursuit'],['pid','PID heading'],['dwa','DWA'],['custom','Your code']]},",
    " ctl:[{k:'ctl',type:'seg',label:'Path tracker',opts:()=>[['pp','Pure pursuit'],...(isCar()?[['stanley','Stanley']]:[]),['pid',isCar()?'PID steering':'PID heading'],['dwa','DWA'],['custom','Your code']]},")
rep("      {k:'alat',label:'Lateral accel limit',min:0.1,max:2,step:0.05,unit:'m/s²',show:()=>P.ctl==='pp'},",
    "      {k:'alat',label:'Lateral accel limit',min:0.1,max:2,step:0.05,unit:'m/s²',show:()=>P.ctl==='pp'||P.ctl==='stanley'},\n      {k:'stanK',label:'Stanley gain k',min:0.1,max:8,step:0.1,show:()=>P.ctl==='stanley'},\n      {type:'info',text:()=>'Reverse legs use pure pursuit.',show:()=>P.ctl==='stanley'},")
rep(""" veh:[{k:'vmax',label:'Max speed v_max',min:0.3,max:2,step:0.05,unit:'m/s'},
      {k:'wmax',label:'Max turn rate ω_max',min:0.3,max:4,step:0.1,unit:'rad/s'},
      {k:'accel',type:'bool',label:'Acceleration limits'},
      {k:'amax',label:'Linear accel',min:0.1,max:3,step:0.05,unit:'m/s²',show:()=>P.accel},
      {k:'alpha',label:'Angular accel',min:0.2,max:8,step:0.1,unit:'rad/s²',show:()=>P.accel},""",
""" veh:[{k:'model',type:'seg',label:'Kinematic model',opts:[['diff','Unicycle (diff-drive)'],['car','Car-like (bicycle)']]},
      {k:'wheelbase',label:'Wheelbase L',min:0.3,max:1.2,step:0.05,unit:'m',show:isCar},
      {k:'steerMaxDeg',label:'Max steering angle δ_max',min:15,max:45,step:1,unit:'°',show:isCar},
      {type:'info',text:()=>`Minimum turning radius L / tan δ_max = ${minTurnR().toFixed(2)} m · body ${carLen().toFixed(2)} × ${CAR.width.toFixed(2)} m`,show:isCar},
      {k:'steerRate',label:'Steering rate limit',min:0.2,max:4,step:0.1,unit:'rad/s',show:isCar},
      {k:'vmax',label:'Max speed v_max (reverse: half)',min:0.3,max:2,step:0.05,unit:'m/s'},
      {k:'wmax',label:'Max turn rate ω_max',min:0.3,max:4,step:0.1,unit:'rad/s',show:()=>!isCar()},
      {k:'accel',type:'bool',label:'Acceleration limits'},
      {k:'amax',label:'Linear accel',min:0.1,max:3,step:0.05,unit:'m/s²',show:()=>P.accel},
      {k:'alpha',label:'Angular accel',min:0.2,max:8,step:0.1,unit:'rad/s²',show:()=>P.accel&&!isCar()},""")
rep("{k:'lostGuard',type:'bool',label:'Stop and turn in place when position σ exceeds 1 m'}],",
    "{k:'lostGuard',type:'bool',label:'Stop when position σ exceeds 1 m (diff-drive also turns in place)'}],")
rep("""  if(f.type==='seg')return`<div class="field"><span class="lbl">${f.label}</span><div class="seg" data-k="${f.k}">${f.opts.map(""",
"""  if(f.type==='info'){infoFns.push(f.text);return`<p class="note" data-info="${infoFns.length-1}">${f.text()}</p>`;}
  if(f.type==='seg')return`<div class="field"><span class="lbl">${f.label}</span><div class="seg" data-k="${f.k}">${(typeof f.opts==='function'?f.opts():f.opts).map(""")
rep("let btnActs=[];","let btnActs=[],infoFns=[];")
rep("rg.oninput=()=>{$('#o-'+f.k).textContent=fmtVal(f,rg.value);setParam(f.k,+rg.value,true);};",
    "rg.oninput=()=>{$('#o-'+f.k).textContent=fmtVal(f,rg.value);setParam(f.k,+rg.value,true);pane.querySelectorAll('[data-info]').forEach(el=>{el.textContent=infoFns[+el.dataset.info]();});};")
rep("  btnActs=btnActs.slice(-20);","  btnActs=btnActs.slice(-20);infoFns=infoFns.slice(-20);")

# ---------- notes ----------
rep("""keeping 0.5 m clearance.</p>`,""","""keeping 0.5 m clearance.</p>
<p><b>Reeds–Shepp</b> (car only) is the shortest path for a car that drives forward and backward with a minimum turning radius, ignoring obstacles. It has a closed-form solution over 48 path words such as L⁺S⁺R⁻ (left forward, straight forward, right reverse).</p>
<p><b>Hybrid A*</b> (car only) searches cells of 0.2 m × 5°, but each node keeps its continuous pose, so every edge is a drivable arc: 5 steering angles × forward/reverse, 0.4 m each.</p>
<div class="eq">g += length·(1 or reverse ×) + gear-change penalty + steering terms + proximity
h  = ε · max(2D Dijkstra with obstacles, Reeds–Shepp without obstacles)
analytic expansion: a Reeds–Shepp shot to the goal every 10 expansions,
                    every expansion within 2.5 m; accepted if collision-free</div>
<p>The two heuristics cover each other's blind spots. The 2D term sees walls but not turning; the Reeds–Shepp term sees turning but not walls. Collision checks use the car footprint (three covering circles) on the costmap distance field.</p>
<p>To give a goal a heading, use <b>Tap map to → Add posed goal</b> and drag in the direction the car should face. Goals without a heading are accepted at any heading.</p>`,""")
rep("""Predicting their motion is the next level up (velocity obstacles, MPC).</p>`,""","""Predicting their motion is the next level up (velocity obstacles, MPC).</p>
<p><b>Car-like model.</b> Pure pursuit outputs steering directly. Stanley uses the front axle as its reference point.</p>
<div class="eq">pure pursuit:  δ = atan(2 L_wb sin α / L_d)
Stanley:       δ = (θ_path − θ) − atan2(k · e_left, 0.5 + |v|)    e_left: front-axle offset, + = left of path</div>
<p>On reverse legs, pure pursuit and PID work in a virtual frame (heading θ + π, steering sign flipped). That is exact for the rear-axle point. Stanley's reference point would trail on a reverse leg, so reverse legs fall back to pure pursuit. A leg ends within 0.12 m of its cusp, and the next leg starts from rest.</p>`,""")
rep("""<p><b>Beacons:</b> range σ = 0.08 m, bearing σ = 0.03 rad (× noise scale), line-of-sight required. <b>Collisions</b> stop translation but allow turning in place.</p>`,""",
"""<p><b>Beacons:</b> range σ = 0.08 m, bearing σ = 0.03 rad (× noise scale), line-of-sight required. <b>Collisions</b> stop translation. The diff-drive robot can still turn in place.</p>
<p><b>Car-like (kinematic bicycle)</b>, pose at the rear-axle centre.</p>
<div class="eq">ẋ = v cos θ,  ẏ = v sin θ,  θ̇ = v tan δ / L
|δ| ≤ δ_max  →  R_min = L / tan δ_max;   |δ̇| ≤ steering rate
command (v, δ) → lag τ → accel limit → steering-rate limit → integrate</div>
<p>The car cannot turn in place: heading changes only while it moves. Physics uses the exact body rectangle. Planners and DWA use three covering circles, which overestimates the bumpers by about 0.14 m. Odometry still reports (v, ω), so localization works unchanged.</p>`,""")

# ---------- setParam ----------
rep("const old=P[k];P[k]=v;if(old===v&&!['infl','eps','rrtIt'].includes(k))return;",
    "const old=P[k];P[k]=v;if(old===v&&!['infl','eps','rrtIt','wheelbase','steerMaxDeg','revPen','gearPen'].includes(k))return;")
rep("  if(k==='seed'&&!live)logE(`Seed ${v} takes effect on Reset`);",
"""  if(k==='seed'&&!live)logE(`Seed ${v} takes effect on Reset`);
  if(k==='model'){S.robot.d=0;S.robot.w=0;S.cmd={v:0,w:0,steer:0};
    if(v==='diff'){if(P.plan==='rs'||P.plan==='hybrid')P.plan='astar';if(P.ctl==='stanley')P.ctl='pp';}
    else if(P.plan!=='rs')P.plan='hybrid';
    logE(v==='car'?'Vehicle → car-like (bicycle) · planner → Hybrid A*':'Vehicle → unicycle (diff-drive)');requestReplan('vehicle model changed');}
  if(['wheelbase','steerMaxDeg','revOK','revPen','gearPen','hybH'].includes(k)&&!live&&(P.plan==='hybrid'||P.plan==='rs'))requestReplan('vehicle or planner changed');""")
rep("{pp:'pure pursuit',pid:'PID heading',dwa:'DWA',custom:'your code'})[v]","{pp:'pure pursuit',pid:'PID',dwa:'DWA',stanley:'Stanley',custom:'your code'})[v]")

# ---------- tap handling ----------
rep("let running=false, speed=1, tapMode='wp', plotCh='ex';","let running=false, speed=1, tapMode='wp', plotCh='ex', poseDrag=null;")
rep("seg($('#tapmode'),[['wp','Add waypoint'],['goal','Set single goal'],['kidnap','Kidnap robot']],()=>tapMode,v=>tapMode=v);",
    "seg($('#tapmode'),[['wp','Add waypoint'],['pose','Add posed goal (drag)'],['goal','Set single goal'],['kidnap','Kidnap robot']],()=>tapMode,v=>{tapMode=v;cv.style.touchAction=v==='pose'?'none':'manipulation';});")
rep("""cv.addEventListener('pointerdown',e=>{
  const r=cv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W,y=H-(e.clientY-r.top)/r.height*H;
  const k=cellIdx(x,y);if(k<0)return;
  const free=LV.truthDist[k]>RR+0.02;
  if(tapMode==='kidnap'){
    if(!free){logE('Cannot place the robot inside an obstacle','warn');return;}
    S.robot.x=x;S.robot.y=y;S.robot.v=0;S.robot.w=0;S.robot.contact=false;S.trailT.push(null);""",
"""const toWorld=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width*W,H-(e.clientY-r.top)/r.height*H];};
function addPosed(x,y,th){
  const k=cellIdx(x,y);if(k<0)return;
  const ok=isCar()&&th!=null?!carHits(x,y,th,S.shapes,0.05):LV.truthDist[k]>(isCar()?CAR.width/2+0.05:RR+0.02);
  if(!ok){logE('That pose overlaps an obstacle','warn');draw();return;}
  if(remaining().length>=8){logE('Up to 8 open waypoints','warn');return;}
  WPS.push({x,y,th,done:false});if(th!=null&&!isCar())logE('Goal heading is only used by the car-like model','warn');
  startMission();doPlan('initial');draw();refreshAll();
}
cv.addEventListener('pointermove',e=>{if(!poseDrag)return;const[x,y]=toWorld(e);poseDrag.x2=x;poseDrag.y2=y;draw();});
cv.addEventListener('pointerup',()=>{if(!poseDrag)return;const d=poseDrag;poseDrag=null;const dx=d.x2-d.x,dy=d.y2-d.y;addPosed(d.x,d.y,hyp(dx,dy)>0.3?Math.atan2(dy,dx):null);});
cv.addEventListener('pointercancel',()=>{poseDrag=null;draw();});
cv.addEventListener('pointerdown',e=>{
  const[x,y]=toWorld(e);
  const k=cellIdx(x,y);if(k<0)return;
  if(tapMode==='pose'){poseDrag={x,y,x2:x,y2:y};try{cv.setPointerCapture(e.pointerId);}catch(_){}draw();return;}
  const free=LV.truthDist[k]>(isCar()?CAR.width/2+0.05:RR+0.02);
  if(tapMode==='kidnap'){
    if(isCar()?carHits(x,y,S.robot.th,S.shapes,0.02):!free){logE('Cannot place the robot inside an obstacle','warn');return;}
    S.robot.x=x;S.robot.y=y;S.robot.v=0;S.robot.w=0;S.robot.d=0;S.robot.contact=false;S.trailT.push(null);""")
rep("  if(tapMode==='goal'){WPS.forEach(w=>w.done=true);WPS=[{x,y,done:false}];}\n  else{if(remaining().length>=8){logE('Up to 8 open waypoints','warn');return;}WPS.push({x,y,done:false});}",
    "  if(tapMode==='goal'){WPS.forEach(w=>w.done=true);WPS=[{x,y,th:null,done:false}];}\n  else{if(remaining().length>=8){logE('Up to 8 open waypoints','warn');return;}WPS.push({x,y,th:null,done:false});}")
