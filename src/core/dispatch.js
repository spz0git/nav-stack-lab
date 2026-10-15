
function builtinCmd(){const c=builtinRaw();
  // car: hold speed until the wheels have turned close to the commanded angle (dry steering at cusps)
  if(isCar()&&c.steer!=null&&P.ctl!=='mpc'){const de=Math.abs(c.steer-S.robot.d);if(de>0.1)c.v*=clamp(1-(de-0.1)/0.25,0,1);}
  return agSpeedCap(c);}
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
