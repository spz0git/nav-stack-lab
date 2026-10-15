/* ============================================================
   Configuration: level loading, parameter changes, kidnapping
   ============================================================ */
function kidnapTo(p){   // p = [x, y] or null for a free spot far from the robot
  const r=S.robot;let best=null;
  if(!p){for(let i=0;i<400;i++){const x=1+S.rngA.u()*(W-2),y=1+S.rngA.u()*(H-2),k=cellIdx(x,y);if(k<0||LV.truthDist[k]<0.8)continue;const d=hyp(x-r.x,y-r.y);if(d>6&&(!best||d>best[2]))best=[x,y,d];if(best&&best[2]>12)break;}
    if(!best)return;p=best;}
  r.x=p[0];r.y=p[1];r.v=0;r.w=0;r.d=0;r.vy=0;r.r=0;r.contact=false;S.trailT.push(null);
  logE(`Robot kidnapped to (${p[0].toFixed(1)}, ${p[1].toFixed(1)}). The estimate was not told.`,'bad');UI.draw();UI.refresh();
}
function loadLevel(i){
  LV=LEVELS[i];Object.assign(P,DEFAULTS,{seed:P.seed},LV.cfg);
  LAYERS.cost=!!(LV.layers&&LV.layers.cost);
  WPS=LV.wps.map(w=>({x:w[0],y:w[1],th:w.length>2?w[2]:null,done:false}));
  running=false;reset();UI.levelChanged();UI.invalidate();
}
function setParam(k,v,live){
  if(k==='veh'){const m=v==='diff'?'diff':'car';if(m!==P.model)setParam('model',m,live);if(m==='car')setParam('carPhys',v==='dyn'?'dyn':'kin',live);return;}
  const old=P[k];P[k]=v;if(k.startsWith('mpc')&&S)S.mpc=null;if(old===v&&!['infl','eps','rrtIt','wheelbase','steerMaxDeg','revPen','gearPen','planPct'].includes(k))return;
  if(k==='loc'||k==='npart'){S.locInit=false;if(SLOTS.loc.worker)SLOTS.loc.worker.reset();initLoc(false);logE(`Localization → ${({truth:'ground truth',dr:'dead reckoning',ekf:'EKF',pf:'particle filter',slam:'EKF-SLAM',custom:'your code'})[P.loc]}`);}
  if(k==='assoc'||k==='inject'||k==='filtK'){S.nees=[];}
  if(k==='agents'){S.agents=agInit();logE(`Agent tracking → ${({off:'off',truth:'ground truth',lidar:'lidar'})[v]}`);}
  if(k==='spd')logE(`Response to agents → ${({none:'ignore',stop:'reactive stop',st:'speed planning'})[v]}`);
  if(k==='per'){if(v==='mapping'){S.lo.fill(0);}buildCostmap();dirty.occ=true;logE(`Map source → ${v==='oracle'?'prior map':'lidar mapping (empty grid)'}`);requestReplan('map source changed');}
  if(k==='unknownAs'||k==='infl'){if(!live){buildCostmap();requestReplan('costmap changed');}}
  if(k==='mis'){if(S.fsm.state!=='IDLE'&&S.fsm.state!=='DONE'){startMission();doPlan('initial');}else logE(`Goal order → ${v}`);}
  if(k==='plan'||k==='smooth'||((k==='eps'||k==='rrtIt')&&!live)){requestReplan('planner changed');}
  if(k==='ctl'){S.ctlState={I:0,prev:null};S.ctlViz=null;SLOTS.ctl.lastErr='';if(SLOTS.ctl.worker)SLOTS.ctl.worker.reset();logE(`Controller → ${({pp:'pure pursuit',rwf:'rear-wheel feedback',pid:'PID',dwa:'DWA',stanley:'Stanley',mpc:'MPC',custom:'your code'})[v]}`);}
  if(k==='agPred'&&SLOTS.pred.worker)SLOTS.pred.worker.reset();
  if(k==='vehicles'||k==='people'){if(k==='vehicles'){S.peds=S.peds.filter(p=>!p.car);if(v)carsInit();}logE(k==='people'?`People → ${v}`:`Other vehicles → ${v?'on':'off'}`);}
  if(k==='bOff'){const n=beaconsOff().size,u=beaconUse();logE(n?`Beacons switched off: ${[...beaconsOff()].join(', ')} (${S.beacons.length-n} of ${S.beacons.length} on)${u?`; note: ${u}`:''}`:'All beacons on',n&&u&&P.loc!=='custom'?'warn':'');}
  if(k==='bOut'&&!live)logE(v>0?`Random beacon outages: each beacon down ${v} % of the time`:'Random beacon outages off');
  if(k==='seed'&&!live)logE(`Seed ${v} takes effect on Reset`);
  if(k==='carPhys'){S.robot.vy=0;S.robot.r=0;logE(v==='dyn'?'Car → dynamic (tyre slip)':'Car → kinematic (no slip)');}
  if(k==='model'){S.robot.d=0;S.robot.w=0;S.robot.vy=0;S.robot.r=0;S.cmd={v:0,w:0,steer:0};
    if(v==='diff'){if(P.plan==='rs'||P.plan==='hybrid')P.plan='astar';if(P.ctl==='stanley')P.ctl='pp';}
    else if(P.plan!=='rs')P.plan='hybrid';
    logE(v==='car'?'Vehicle → car-like (bicycle) · planner → Hybrid A*':'Vehicle → unicycle (diff-drive)');requestReplan('vehicle model changed');}
  if(['wheelbase','steerMaxDeg','revOK','revPen','gearPen','hybH','planPct'].includes(k)&&!live&&(P.plan==='hybrid'||P.plan==='rs'))requestReplan('vehicle or planner changed');
  UI.invalidate();
  if(UI.mode()==='sim'){UI.draw();UI.refresh();}
}
function toggleBeacon(id){
  const s=beaconsOff();if(s.has(id))s.delete(id);else s.add(id);
  setParam('bOff',[...s].sort((a,b)=>a-b).join(','),false);
}
function requestReplan(reason){
  const F=S.fsm;if(F.state==='DRIVE'||F.state==='NO_PATH'||F.state==='PLAN'){F.state='PLAN';F.pendingReason=reason;if(!running)advanceMission();}
}
function advanceMission(){missionTick();UI.draw();UI.refresh();}
