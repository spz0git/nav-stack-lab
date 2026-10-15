
/* ============================================================
   High-level planning: mission ordering + state machine
   ============================================================ */
function remaining(){return WPS.map((w,i)=>w.done?-1:i).filter(i=>i>=0);}
function computeOrder(idx){
  if(idx.length<2||P.mis==='sequential')return{order:idx.slice(),cost:null};
  const pts=[[S.est.x,S.est.y],...idx.map(i=>[WPS[i].x,WPS[i].y])],n=idx.length;
  const C=[];
  for(let a=0;a<=n;a++){let s=cellIdx(pts[a][0],pts[a][1]);if(S.cm.lethal[s])s=nearestFree(s);const R=gridSearch(s,-1,1);C.push(pts.map(p=>{const k=cellIdx(p[0],p[1]);const v=R.gs[k];return isFinite(v)?v:1e6;}));}
  let order;
  if(P.mis==='greedy'){order=[];const used=new Array(n+1).fill(false);let u=0;for(let k=0;k<n;k++){let b=-1;for(let v=1;v<=n;v++)if(!used[v]&&(b<0||C[u][v]<C[u][b]))b=v;used[b]=true;order.push(b);u=b;}}
  else{let best=Infinity,bestP=null;const used=new Array(n+1).fill(false),cur=[];
    (function dfs(u,c,d){if(c>=best)return;if(d===n){best=c;bestP=cur.slice();return;}for(let v=1;v<=n;v++)if(!used[v]){used[v]=true;cur.push(v);dfs(v,c+C[u][v],d+1);cur.pop();used[v]=false;}})(0,0,0);order=bestP;}
  let cost=0,u=0;for(const v of order){cost+=C[u][v];u=v;}
  return{order:order.map(v=>idx[v-1]),cost};
}
function startMission(){
  const F=S.fsm,rem=remaining();
  if(!rem.length){F.state=WPS.length?'DONE':'IDLE';F.queue=[];S.track=null;S.plan=null;return;}
  const r=computeOrder(rem);F.queue=r.order;F.cost=r.cost;F.state='PLAN';
  const names={sequential:'in order',greedy:'greedy nearest',optimal:'optimal'};
  logE(`Mission: ${F.queue.length} goal${F.queue.length>1?'s':''}, ${names[P.mis]}${r.cost!=null?` · cost ${r.cost.toFixed(1)}`:''}`);
}
const POSE_PLANNERS=['hybrid','rs','custom'],ALIGN_TOL=0.035;   // planners that take the goal heading; unicycle alignment tolerance [rad]
const PLAN_NAMES={straight:'Straight',astar:'A*',rrtstar:'RRT*',rs:'Reeds–Shepp',hybrid:'Hybrid A*',stastar:'Space-time A*',custom:'Your code'};
function doPlan(reason){
  const F=S.fsm;
  if(!F.queue.length){F.state='DONE';S.track=null;S.plan=null;return;}
  const agL=reason==='agent blocking'&&P.plan!=='stastar'&&agCostLayer();   // predicted agents enter the costmap for this plan only
  const wp=WPS[F.queue[0]],e=S.est,t0=performance.now();let res;S.searchTrace=null;
  if(P.plan==='custom'){customPlanStart(wp,reason);if(agL)buildCostmap();return;}
  if(P.plan==='straight')res={ok:true,pts:[[e.x,e.y],[wp.x,wp.y]],exp:0};
  else if(P.plan==='astar')res=astar(e.x,e.y,wp.x,wp.y);
  else if(P.plan==='rs')res=rsPlan(e,wp);
  else if(P.plan==='hybrid')res=hybridAstar(e,wp);
  else if(P.plan==='stastar')res=stAstar(e.x,e.y,wp.x,wp.y);
  else res=rrtstar(e.x,e.y,wp.x,wp.y);
  if(P.plan==='straight')S.search=null;
  applyPlanResult(res,PLAN_NAMES[P.plan],reason,t0,agL);
}
function applyPlanResult(res,name,reason,t0,agL){
  const F=S.fsm,e=S.est,ms=performance.now()-t0;F.lastPlanT=S.t;if(agL)buildCostmap();
  if(!F.queue.length)return;
  if(res.ok){
    setPlan(res.segs||[{pts:res.pts,dir:1}]);F.state='DRIVE';F.fails=0;if(reason==='initial'||reason==='relocalized')F.prog={t:S.t,x:e.x,y:e.y};S.ctlState={I:0,prev:null};
    S.planStats={name,len:res.len!=null?res.len:pathLen(res.pts||res.segs.flatMap(s=>s.pts)),exp:res.exp,ms,extra:res.extra||''};
    if(reason!=='periodic')logE(`${reason==='initial'?'Plan':'Replan ('+reason+')'} · ${name} ${S.planStats.len.toFixed(1)} m${(P.plan==='astar'||P.plan==='hybrid'||P.plan==='stastar'||(P.plan==='custom'&&res.exp))?` · ${res.exp} expansions`:P.plan==='rrtstar'?` · ${res.exp} nodes`:''}${res.extra?' · '+res.extra:''} · ${ms.toFixed(0)} ms`, reason==='initial'?'':'warn');
  }else{
    F.state='NO_PATH';F.fails++;S.track=null;S.plan=null;
    logE(`${name}: no path to goal ${wpLabel(F.queue[0])} (${res.reason})`,'bad');
    if(F.fails>=3){logE(`Skipping goal ${wpLabel(F.queue[0])} after 3 attempts`,'bad');WPS[F.queue[0]].done=true;WPS[F.queue[0]].skipped=true;F.queue.shift();F.fails=0;F.state=F.queue.length?'PLAN':'DONE';}
  }
}
function wpLabel(i){return i+1;}
const posSigma=()=>S.Pc?Math.sqrt(Math.max(0,S.Pc[0]+S.Pc[4])):0;
function missionTick(){
  const F=S.fsm;
  if(F.state==='PLAN'){if(F.planPending)return;doPlan(F.pendingReason||'initial');F.pendingReason=null;return;}
  if(F.state==='NO_PATH'){if(S.t-F.lastPlanT>2){F.state='PLAN';F.pendingReason='retry';}return;}
  if(F.state==='LOST'){if(posSigma()<0.4){logE(`Relocalized (σ ${posSigma().toFixed(2)} m). Resuming.`,'ok');F.state='PLAN';F.pendingReason='relocalized';}return;}
  if(F.state!=='DRIVE')return;
  if(P.lostGuard&&S.Pc&&posSigma()>1.0){F.state='LOST';logE(`Position σ ${posSigma().toFixed(1)} m: holding and turning in place to find beacons`,'warn');return;}
  const wp=WPS[F.queue[0]],e=S.est;
  let lastSeg=!S.plan||S.segIdx>=S.plan.segs.length-1;
  if(!lastSeg){
    const pr=project(e.x,e.y,true),T=S.track,end=T.pts[T.pts.length-1];
    if(T.total-pr.s<0.12||hyp(end[0]-e.x,end[1]-e.y)<0.1){
      S.segIdx++;loadSeg(S.segIdx);F.prog={t:S.t,x:e.x,y:e.y};
      logE(`Cusp → ${S.track.dir>0?'forward':'reverse'} (leg ${S.segIdx+1}/${S.plan.segs.length})`);
      lastSeg=S.segIdx>=S.plan.segs.length-1;
    }
  }
  // A goal with a heading: the car's pose planners (Hybrid A*, Reeds–Shepp, your code) arrive with it; the unicycle
  // drives to the point and then turns in place (F.align) until the estimate faces the goal heading within ALIGN_TOL.
  // Point planners on the car cannot honour it, so the heading is reported and not waited for.
  const posed=wp.th!=null&&(!isCar()||POSE_PLANNERS.includes(P.plan));
  if(wp.th!=null&&isCar()&&!posed&&F.headWarn!==F.queue[0]){F.headWarn=F.queue[0];logE(`${PLAN_NAMES[P.plan]} plans to a point and ignores the goal heading; Hybrid A* or Reeds–Shepp arrive with it`,'warn');}
  const hErr=posed?Math.abs(wrap(e.th-wp.th)):0,headOK=!posed||hErr<(isCar()?0.2:ALIGN_TOL);
  const legDone=!isCar()||!S.track||(S.track.total-project(e.x,e.y,true).s<0.08);
  const near=hyp(e.x-wp.x,e.y-wp.y)<(posed&&isCar()?0.2:ARRIVE);
  if(posed&&!isCar()&&lastSeg&&near&&!headOK&&!F.align){F.align=true;F.prog={t:S.t,x:e.x,y:e.y};logE(`At goal ${wpLabel(F.queue[0])}: turning in place to ${deg(wp.th).toFixed(0)}° (${deg(hErr).toFixed(0)}° to go)`);}
  if(F.align&&(!near||!posed)){F.align=false;}
  if(F.align){if(!headOK)return;}
  if(lastSeg&&headOK&&legDone&&near){F.align=false;
    const te=hyp(S.robot.x-wp.x,S.robot.y-wp.y),he=posed?Math.abs(deg(wrap(S.robot.th-wp.th))):0;
    logE(`Reached goal ${wpLabel(F.queue[0])} by estimate · true error ${te.toFixed(2)} m${posed?` · ${he.toFixed(0)}°`:''}`,(te>0.5||he>20)?'warn':'ok');
    wp.done=true;F.queue.shift();F.stuckN=0;S.ctlState={I:0,prev:null};
    if(F.queue.length){F.state='PLAN';F.pendingReason='initial';}else{F.state='DONE';S.track=null;S.plan=null;logE(`Mission complete in ${S.t.toFixed(1)} s`,'ok');}
    return;
  }
  // the estimate is far from the path (kidnapped, relocalized, pushed aside): plan again from where the robot is now
  if(S.t-F.lastPlanT>0.5&&project(e.x,e.y,true).d>OFFPATH){F.state='PLAN';F.pendingReason='off path';return;}
  if(P.replan>0&&S.t-F.lastPlanT>=P.replan){F.state='PLAN';F.pendingReason='periodic';return;}
  if(P.plan==='hybrid'&&isCar()&&S.t-F.lastBlockT>0.5){
    // footprint check of the remaining legs (poses carry heading)
    F.lastBlockT=S.t;const pr=project(e.x,e.y,true);let trav=0,first=true;
    for(let gi=S.segIdx;gi<S.plan.segs.length&&trav<6;gi++){const pts=S.plan.segs[gi].pts;
      for(let i=(gi===S.segIdx?pr.i+2:1);i<pts.length&&trav<6;i++){trav+=hyp(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
        const c=fpClear(pts[i][0],pts[i][1],pts[i][2],S.cm.dist);if(c<0&&first)continue;first=false;
        if(c<0){F.state='PLAN';F.pendingReason='path blocked';return;}}}
  }
  else if(P.plan!=='straight'&&P.plan!=='rs'&&S.t-F.lastBlockT>0.5){
    F.lastBlockT=S.t;const pr=project(e.x,e.y,true);
    let exiting=true;for(let s=pr.s+0.2;s<Math.min(S.track.total,pr.s+6);s+=0.1){const p=pointAt(s),k=cellIdx(p[0],p[1]);const bad=k>=0&&S.cm.lethal[k];if(bad&&exiting)continue;exiting=false;if(bad){F.state='PLAN';F.pendingReason='path blocked';return;}}
  }
  if(S.t-F.prog.t>5){
    if(hyp(e.x-F.prog.x,e.y-F.prog.y)<0.15){F.stuckN=(F.stuckN||0)+1;if(F.stuckN>=3){logE(`Skipping goal ${wpLabel(F.queue[0])}: stuck 3 times`,'bad');WPS[F.queue[0]].done=true;WPS[F.queue[0]].skipped=true;F.queue.shift();F.stuckN=0;F.state=F.queue.length?'PLAN':'DONE';F.pendingReason='initial';if(!F.queue.length){S.track=null;S.plan=null;}}else{F.state='PLAN';F.pendingReason='stuck';}}
    F.prog={t:S.t,x:e.x,y:e.y};
  }
}
