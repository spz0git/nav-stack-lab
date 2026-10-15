
function builtinCmd(){const c=builtinRaw();
  // car: hold speed until the wheels have turned close to the commanded angle (dry steering at cusps)
  if(isCar()&&c.steer!=null&&P.ctl!=='mpc'){const de=Math.abs(c.steer-S.robot.d);if(de>0.1)c.v*=clamp(1-(de-0.1)/0.25,0,1);}
  return lidarGuard(agSpeedCap(c));}
// Lidar safety stop for the path trackers (P.guard), like a robot's collision monitor: they follow the path and never read
// the lidar, so a wall the map has wrong (drift, a late scan) or a corner cut on the swing round it is hit side-on.
// Sweep the footprint along the commanded arc against this scan's points (placed with the estimate, so their positions
// relative to the robot are as measured) and cap the speed at what stops before the first point closer than MARGIN
// that the arc approaches. DWA and MPC check the scan themselves.
const GUARD_CTL=['pp','pid','stanley','rwf'],GUARD_MARG=0.05;
function lidarGuard(c){
  S.guard=null;
  if(!P.guard||!GUARD_CTL.includes(P.ctl)||S.fsm.state!=='DRIVE'||!S.track)return c;
  const v=c.v||0,sp=Math.abs(v);if(sp<1e-3)return c;
  const e=S.est,A=P.accel?P.amax:0.8,D=Math.min(3,sp*sp/(2*A)+0.4),pts=S.scanPts.filter(p=>hyp(p[0]-e.x,p[1]-e.y)<D+1);
  if(!pts.length)return c;
  const k=isCar()?Math.tan(c.steer!=null?c.steer:0)/P.wheelbase:(c.w||0)/v;   // curvature per metre driven (signed with v)
  const clear=(x,y,th)=>{let m=Infinity;for(const[cx,cy,r]of fpCircles(x,y,th))for(const p of pts){const d=hyp(p[0]-cx,p[1]-cy)-r;if(d<m)m=d;}return m;};
  const c0=clear(e.x,e.y,e.th),dir=Math.sign(v);let x=e.x,y=e.y,th=e.th,free=D;
  for(let s=0.05;s<=D+1e-9;s+=0.05){const n=integ(x,y,th,dir,dir*k,0.05);x=n.x;y=n.y;th=n.th;const cl=clear(x,y,th);
    if(cl<GUARD_MARG&&cl<c0-0.005){free=s-0.05;break;}}
  const vm=Math.sqrt(2*A*Math.max(0,free-0.05));if(sp<=vm)return c;
  const f=vm/sp;S.guard={free,v:vm};
  if(!S.guardLogT||S.t-S.guardLogT>3){S.guardLogT=S.t;logE(`Safety stop: lidar points ${free.toFixed(2)} m ahead on the commanded arc · speed capped at ${vm.toFixed(2)} m/s`,'warn');}
  const o={...c,v:v*f};if(!isCar()&&o.w!=null)o.w=c.w*f;return o;
}
// At a goal with a heading (unicycle): stop and turn in place, proportional on the heading error, within the turn-rate limit
function alignCmd(){const wp=WPS[S.fsm.queue[0]],err=wp&&wp.th!=null?wrap(wp.th-S.est.th):0;S.ctlViz=null;
  const wm=Math.min(P.wmax,1.5);return{v:0,w:Math.sign(err)*clamp(2.5*Math.abs(err),0.15,wm)};}
function builtinRaw(){
  if(S.fsm.state==='LOST'){S.ctlViz=null;return{v:0,w:Math.min(0.6,P.wmax)};}
  if(S.fsm.state!=='DRIVE'||!S.track){S.ctlViz=null;return{v:0,w:0};}
  if(S.fsm.align)return alignCmd();
  if(P.ctl==='pp')return ctlPP(); if(P.ctl==='pid')return ctlPID(); if(P.ctl==='dwa')return ctlDWA(); if(P.ctl==='stanley')return ctlStanley(); if(P.ctl==='rwf')return ctlRWF(); if(P.ctl==='mpc')return ctlMPC();
  return{v:0,w:0};
}
