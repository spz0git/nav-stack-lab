# path curvature per vertex (travel direction), for feedforward
rep("""  S.track={pts,s,total:s[s.length-1],idx:0,dir:1};S.pathId++;""",
"""  S.track={pts,s,total:s[s.length-1],idx:0,dir:1};S.pathId++;
  const n=pts.length,hd=[],kv=new Float64Array(n);for(let i=0;i<n-1;i++)hd.push(Math.atan2(pts[i+1][1]-pts[i][1],pts[i+1][0]-pts[i][0]));
  for(let i=1;i<n-1;i++){const l=(s[i+1]-s[i-1])/2;kv[i]=l>1e-6?wrap(hd[i]-hd[i-1])/l:0;}if(n>2)kv[0]=kv[1];
  S.track.hd=hd;S.track.kv=kv;""")
rep("const vCap=dir=>","""function kapAt(sArc){const T=S.track;if(sArc>=T.total||sArc<0)return 0;let i=T.idx;while(i>0&&T.s[i]>sArc)i--;while(i<T.pts.length-2&&T.s[i+1]<sArc)i++;
  const t=(sArc-T.s[i])/((T.s[i+1]-T.s[i])||1);return T.kv[i]+(T.kv[i+1]-T.kv[i])*t;}
// Rear-wheel feedback (Samson; Paden et al. 2016 §V-A): curvature feedforward + heading and lateral feedback
function ctlRWF(){
  const{e,T,pr,dir,thv}=trackPre(),q=pointAt(pr.s),i=Math.min(pr.i,T.hd.length-1),thp=T.hd[i];
  const el=Math.cos(thp)*(e.y-q[1])-Math.sin(thp)*(e.x-q[0]),the=wrap(thv-thp);  // el > 0: left of path
  const vprev=Math.abs(S.odo.v),kmax=isCar()?Math.tan(steerMax())/P.wheelbase:3;
  const k=clamp(kapAt(pr.s+0.1+0.3*vprev),-kmax,kmax);
  let kpk=0;for(let ds=0;ds<=0.8;ds+=0.2)kpk=Math.max(kpk,Math.abs(kapAt(pr.s+ds)));
  let v=Math.min(P.vcruise,vCap(dir));if(kpk>1e-6)v=Math.min(v,Math.sqrt(P.alat/kpk));
  v=Math.min(v,decelCap(goalDist(pr)));
  const sinc=Math.abs(the)<1e-4?1:Math.sin(the)/the;
  const kc=k*Math.cos(the)/Math.max(0.3,1-k*el)-P.rwKth*the-P.rwKe*sinc*el;
  S.ctlViz={carrot:q};
  if(isCar()){const dv=clamp(Math.atan(P.wheelbase*kc),-steerMax(),steerMax());return{v:dir*v,steer:dir*dv};}
  if(Math.abs(the)>Math.PI/2)return{v:0,w:-Math.sign(the)*P.wmax*0.7};
  return{v,w:clamp(v*kc,-P.wmax,P.wmax)};
}
const vCap=dir=>""")
rep("if(P.ctl==='stanley')return ctlStanley();","if(P.ctl==='stanley')return ctlStanley(); if(P.ctl==='rwf')return ctlRWF();")
rep("mis:'sequential',replan:0,lostGuard:false,","mis:'sequential',replan:0,lostGuard:false,rwKth:2.0,rwKe:3.0,")
rep("opts:()=>[['pp','Pure pursuit'],...(isCar()?[['stanley','Stanley']]:[]),","opts:()=>[['pp','Pure pursuit'],['rwf','Rear-wheel feedback'],...(isCar()?[['stanley','Stanley']]:[]),")
rep("      {k:'stanK',label:'Stanley gain k',","      {k:'rwKth',label:'Heading gain k_θ',min:0,max:6,step:0.1,unit:'1/m',show:()=>P.ctl==='rwf'},\n      {k:'rwKe',label:'Lateral gain k_e',min:0,max:12,step:0.1,unit:'1/m²',show:()=>P.ctl==='rwf'},\n      {k:'stanK',label:'Stanley gain k',")
rep("show:()=>P.ctl==='pp'||P.ctl==='stanley'},","show:()=>P.ctl==='pp'||P.ctl==='stanley'||P.ctl==='rwf'},")
rep("{pp:'pure pursuit',pid:'PID',dwa:'DWA',stanley:'Stanley',custom:'your code'}","{pp:'pure pursuit',rwf:'rear-wheel feedback',pid:'PID',dwa:'DWA',stanley:'Stanley',custom:'your code'}")
rep("plan:'hybrid',ctl:'pp',odoK:0,odoB:0,accel:false,lag:0,assoc:'known',clutter:0,replan:0,vcruise:0.6,ppL0:0.4,ppK:0.3}",
    "plan:'hybrid',ctl:'rwf',odoK:0,odoB:0,accel:false,lag:0,assoc:'known',clutter:0,replan:0,vcruise:0.6,ppL0:0.4,ppK:0.3}")
rep("""<p><b>Car-like model.</b> Pure pursuit outputs steering directly. Stanley uses the front axle as its reference point.</p>""",
"""<p><b>Rear-wheel feedback</b> (Samson; Paden et al. 2016) projects the rear axle onto the path and commands a curvature: the path's own curvature as feedforward, plus heading and lateral feedback. It works for both models (ω = v·κ for diff-drive, δ = atan(L·κ) for the car).</p>
<div class="eq">κ_cmd = κ(s)·cos θe / (1 − κ(s)·e) − k_θ·θe − k_e·(sin θe / θe)·e
e: lateral offset (+ left),  θe: heading error,  κ(s) previewed 0.1 m + 0.3 s ahead</div>
<p>Pure pursuit has no feedforward. On full-lock arcs it cuts the inside of the turn, which is why it struggles in the parking lot.</p>
<p><b>Car-like model.</b> Pure pursuit outputs steering directly. Stanley uses the front axle as its reference point.</p>""")
rep("'<b>Control:</b> Stanley versus pure pursuit on forward legs. Use the Steering plot, and lower the steering rate limit in Vehicle.',",
    "'<b>Control:</b> the default is rear-wheel feedback (curvature feedforward). Switch to pure pursuit and watch it cut the inside of full-lock arcs. Then try Stanley and lower the steering rate limit in Vehicle.',")
# planner leniency when the start overlaps an obstacle: based on distance from the start, not cost
rep("const c=clearAt(nx,ny,nt),need=(lenient&&B.g[u]<0.8)?Math.min(MARG,startClear-0.02):MARG;",
    "const c=clearAt(nx,ny,nt),need=(lenient&&hyp(nx-e.x,ny-e.y)<1.0)?Math.min(MARG,startClear-0.02):MARG;")
