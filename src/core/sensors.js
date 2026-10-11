
/* ============================================================
   Sensors
   ============================================================ */
function lidarSense(){
  const r=S.robot,g=S.rngW,sh=allShapes();
  const ranges=new Float32Array(NBEAM);
  for(let k=0;k<NBEAM;k++){const a=r.th-Math.PI+k*TAU/NBEAM;let d=rayCast(r.x,r.y,Math.cos(a),Math.sin(a),LMAX,sh);if(d<LMAX)d=Math.max(0.05,d+P.lidarSig*g.n());ranges[k]=d;}
  return ranges;
}
function senseBeacons(){
  const r=S.robot,g=S.rngW,sh=allShapes(),out=[];
  const sr=0.08*P.lmK, sb=0.03*P.lmK;
  for(const b of S.beacons){
    const dx=b.x-r.x,dy=b.y-r.y,d=hyp(dx,dy);
    if(d>P.lmRange||d<0.2)continue;
    if(rayCast(r.x,r.y,dx/d,dy/d,d,sh)<d-0.12)continue;
    out.push({id:b.id,r:d+sr*g.n(),b:wrap(Math.atan2(dy,dx)-r.th+sb*g.n())});
  }
  if(P.assoc==='unknown'&&P.clutter>0){for(let k=0;k<3;k++)if(g.u()<P.clutter/3)out.push({id:-1,fake:true,r:0.5+g.u()*(P.lmRange-0.5),b:(g.u()*2-1)*Math.PI});}
  return out;
}
