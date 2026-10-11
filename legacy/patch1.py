import re
s=open('nav-stack-lab.html').read()
rs=open('car/rs.js').read()
rs=rs[rs.index('/* RS_BEGIN */'):rs.index('/* RS_END */')]
def rep(a,b,cnt=1):
    global s
    n=s.count(a)
    assert n==cnt,(a[:80],n)
    s=s.replace(a,b)

# ---------- constants, car geometry, collision helpers ----------
rep("const ARRIVE=0.25;",
"""const ARRIVE=0.25;
const CAR={rear:0.15,front:0.15,width:0.5};   // overhangs and width [m]; pose = rear-axle centre""")
rep("class Heap{",
"""const isCar=()=>P.model==='car';
const steerMax=()=>P.steerMaxDeg*Math.PI/180;
const minTurnR=()=>P.wheelbase/Math.tan(steerMax());
const carLen=()=>CAR.rear+P.wheelbase+CAR.front;
// Footprint as covering circles (used by planners and DWA). Diff-drive: one circle.
function fpCircles(x,y,th){
  if(!isCar())return[[x,y,RR]];
  const part=carLen()/3,r=Math.hypot(part/2,CAR.width/2),c=Math.cos(th),s=Math.sin(th),out=[];
  for(let i=0;i<3;i++){const o=-CAR.rear+part*(i+0.5);out.push([x+o*c,y+o*s,r]);}
  return out;
}
// Exact oriented-rectangle test for the car body (used by physics)
function carHits(x,y,th,shapes,m){
  m=m||0;const c=Math.cos(th),s=Math.sin(th),hl=carLen()/2+m,hw=CAR.width/2+m,off=carLen()/2-CAR.rear,cx=x+off*c,cy=y+off*s,ac=Math.abs(c),as=Math.abs(s);
  for(const sh of shapes){
    if(sh.t==='c'){const dx=sh.x-cx,dy=sh.y-cy,lx=dx*c+dy*s,ly=-dx*s+dy*c,qx=clamp(lx,-hl,hl),qy=clamp(ly,-hw,hw);if(Math.hypot(lx-qx,ly-qy)<sh.r)return true;continue;}
    const ex=sh.w/2,ey=sh.h/2,dx=sh.x+ex-cx,dy=sh.y+ey-cy;
    if(Math.abs(dx)>ex+hl*ac+hw*as)continue;
    if(Math.abs(dy)>ey+hl*as+hw*ac)continue;
    if(Math.abs(dx*c+dy*s)>hl+ex*ac+ey*as)continue;
    if(Math.abs(-dx*s+dy*c)>hw+ex*as+ey*ac)continue;
    return true;
  }
  return false;
}
const bodyHits=(x,y,th,shapes,m)=>isCar()?carHits(x,y,th,shapes,m):circleHits(x,y,RR+(m||0),shapes);
// Smallest footprint clearance against a distance field
function fpClear(x,y,th,dist){let m=Infinity;for(const[cx,cy,r]of fpCircles(x,y,th)){const k=cellIdx(cx,cy);if(k<0)return -1;const d=dist[k]-r;if(d<m)m=d;}return m;}
class Heap{""")

# ---------- defaults ----------
rep("mis:'sequential',replan:0,lostGuard:false,",
    "mis:'sequential',replan:0,lostGuard:false,model:'diff',wheelbase:0.6,steerMaxDeg:32,steerRate:1.5,revOK:true,revPen:2.0,gearPen:2.0,hybH:'both',stanK:2.0,")

# ---------- robot state ----------
rep("robot:{x:st[0],y:st[1],th:st[2],v:0,w:0,contact:false,pedContact:false},",
    "robot:{x:st[0],y:st[1],th:st[2],v:0,w:0,d:0,contact:false,pedContact:false},")
rep("cmd:{v:0,w:0},odo:{v:0,w:0},","cmd:{v:0,w:0,steer:0},odo:{v:0,w:0},plan:null,segIdx:0,")
rep("for(const w of WPS)w.done=false;","for(const w of WPS){w.done=false;w.skipped=false;}")

# ---------- actuation ----------
rep("""  let vt=clamp(c.v,-0.5*P.vmax,P.vmax), wt=clamp(c.w,-P.wmax,P.wmax);
  if(P.lag>0){const a=1-Math.exp(-DT/P.lag);vt=r.v+(vt-r.v)*a;wt=r.w+(wt-r.w)*a;}
  if(P.accel){vt=clamp(vt,r.v-P.amax*DT,r.v+P.amax*DT);wt=clamp(wt,r.w-P.alpha*DT,r.w+P.alpha*DT);}
  const n=integ(r.x,r.y,r.th,vt,wt,DT);
  if(circleHits(n.x,n.y,RR,S.shapes)){
    r.th=wrap(r.th+wt*DT); r.v=0; r.w=wt;""",
"""  let vt=clamp(c.v,-0.5*P.vmax,P.vmax),wt;
  if(isCar()){
    // bicycle: command (v, δ) → lag → accel limit → steering-rate limit → ω = v tanδ / L
    const dm=steerMax();let st=clamp(c.steer||0,-dm,dm);
    if(P.lag>0){const a=1-Math.exp(-DT/P.lag);vt=r.v+(vt-r.v)*a;st=r.d+(st-r.d)*a;}
    if(P.accel)vt=clamp(vt,r.v-P.amax*DT,r.v+P.amax*DT);
    r.d=clamp(st,r.d-P.steerRate*DT,r.d+P.steerRate*DT);
    wt=vt*Math.tan(r.d)/P.wheelbase;
  }else{
    wt=clamp(c.w,-P.wmax,P.wmax);
    if(P.lag>0){const a=1-Math.exp(-DT/P.lag);vt=r.v+(vt-r.v)*a;wt=r.w+(wt-r.w)*a;}
    if(P.accel){vt=clamp(vt,r.v-P.amax*DT,r.v+P.amax*DT);wt=clamp(wt,r.w-P.alpha*DT,r.w+P.alpha*DT);}
  }
  const n=integ(r.x,r.y,r.th,vt,wt,DT);
  if(bodyHits(n.x,n.y,n.th,S.shapes)){
    if(!isCar())r.th=wrap(r.th+wt*DT); r.v=0; r.w=isCar()?0:wt;""")
rep("if(r.contact&&!circleHits(r.x,r.y,RR+0.05,S.shapes))r.contact=false;","if(r.contact&&!bodyHits(r.x,r.y,r.th,S.shapes,0.05))r.contact=false;")
rep("let pc=false;for(const p of S.peds)if(hyp(p.x-r.x,p.y-r.y)<RR+p.r)pc=true;",
    "let pc=false;if(isCar())pc=S.peds.length>0&&carHits(r.x,r.y,r.th,S.peds.map(p=>({t:'c',x:p.x,y:p.y,r:p.r})));else for(const p of S.peds)if(hyp(p.x-r.x,p.y-r.y)<RR+p.r)pc=true;")

# ---------- Reeds-Shepp + Hybrid A* (insert before path tracking helpers) ----------
rep("/* ---------- path tracking helpers ---------- */",
rs+r"""
/* ---------- Reeds–Shepp only (ignores obstacles) ---------- */
function rsPlan(e,wp){
  const R=minTurnR(),th=wp.th!=null?wp.th:Math.atan2(wp.y-e.y,wp.x-e.x);
  const c=RS.solve([e.x,e.y,e.th],[wp.x,wp.y,th],R)[0];
  S.search=null;
  if(!c)return{ok:false,reason:'no Reeds–Shepp solution'};
  const segs=RS.sample([e.x,e.y,e.th],c,R,0.1);
  return{ok:true,segs,len:c.len*R,exp:0,extra:`${c.T} · ${segs.length-1} cusp${segs.length===2?'':'s'}`};
}

/* ---------- Hybrid A* (Dolgov et al. 2008) ---------- */
const HY={XY:0.2,NT:72};HY.NX=Math.ceil(W/HY.XY);HY.NY=Math.ceil(H/HY.XY);HY.N=HY.NX*HY.NY*HY.NT;
let HYB=null;
function hyBuf(){if(!HYB)HYB={g:new Float32Array(HY.N),closed:new Uint8Array(HY.N),par:new Int32Array(HY.N),x:new Float32Array(HY.N),y:new Float32Array(HY.N),th:new Float32Array(HY.N),dir:new Int8Array(HY.N),st:new Float32Array(HY.N)};
  HYB.g.fill(Infinity);HYB.closed.fill(0);return HYB;}
// obstacle-aware, non-holonomic-free heuristic: 8-connected Dijkstra from the goal on the 0.1 m grid
function holoField(gx,gy,dist,thr){
  const h=new Float32Array(NC).fill(Infinity),done=new Uint8Array(NC),heap=new Heap(),g=cellIdx(gx,gy);
  if(g<0)return h;h[g]=0;heap.push(g,0);
  while(heap.size){const u=heap.pop();if(done[u])continue;done[u]=1;const ui=u%GW,uj=(u/GW)|0;
    for(const[di,dj,c]of NB){const vi=ui+di,vj=uj+dj;if(vi<0||vj<0||vi>=GW||vj>=GH)continue;const v=vj*GW+vi;if(done[v]||dist[v]<thr)continue;
      const ng=h[u]+c*RES;if(ng<h[v]){h[v]=ng;heap.push(v,ng);}}}
  return h;
}
function hybridAstar(e,wp){
  const dist=S.cm.dist,L=P.wheelbase,dm=steerMax(),R=minTurnR(),MARG=0.08,STEP=0.4,SUB=0.1,BUDGET=60000;
  const goalTh=wp.th!=null?wp.th:null,q1=[wp.x,wp.y,goalTh];
  const part=carLen()/3,rc=Math.hypot(part/2,CAR.width/2),offs=[0,1,2].map(i=>-CAR.rear+part*(i+0.5));
  const clearAt=(x,y,th)=>{const c=Math.cos(th),s=Math.sin(th);let m=Infinity;for(const o of offs){const k=cellIdx(x+o*c,y+o*s);if(k<0)return -1;const d=dist[k]-rc;if(d<m)m=d;}return m;};
  if(goalTh!=null&&clearAt(wp.x,wp.y,goalTh)<MARG)return{ok:false,reason:'the goal pose overlaps an obstacle'};
  if(goalTh==null&&cellIdx(wp.x,wp.y)>=0&&dist[cellIdx(wp.x,wp.y)]<CAR.width/2+MARG)return{ok:false,reason:'goal is too close to an obstacle for the car'};
  const startClear=clearAt(e.x,e.y,e.th),lenient=startClear<MARG;
  const h2=holoField(wp.x,wp.y,dist,CAR.width/2+0.02);
  const h2At=(x,y)=>{const k=cellIdx(x,y);if(k<0)return Infinity;const v=h2[k];return isFinite(v)?v:hyp(x-wp.x,y-wp.y)+20;};
  const useRS=goalTh!=null&&P.hybH==='both';
  const hAt=(x,y,th)=>{let h=h2At(x,y);if(useRS&&h<5){const r=RS.length([x,y,th],q1,R);if(r>h)h=r;}return h;};
  const B=hyBuf(),NT=HY.NT,XY=HY.XY,NX=HY.NX;
  const key=(x,y,th)=>{const i=Math.floor(x/XY),j=Math.floor(y/XY);if(i<0||j<0||i>=NX||j>=HY.NY)return -1;return (j*NX+i)*NT+(((Math.round(th/(TAU/NT))%NT)+NT)%NT);};
  const steers=[-dm,-dm/2,0,dm/2,dm],dirs=P.revOK?[1,-1]:[1];
  const s0=key(e.x,e.y,e.th);if(s0<0)return{ok:false,reason:'start is outside the map'};
  B.g[s0]=0;B.par[s0]=-1;B.x[s0]=e.x;B.y[s0]=e.y;B.th[s0]=e.th;B.dir[s0]=0;B.st[s0]=S.robot.d||0;
  const heap=new Heap();heap.push(s0,P.eps*hAt(e.x,e.y,e.th));
  const viz=[];let exp=0,fin=-1,tail=null,shots=0;
  while(heap.size&&exp<BUDGET){
    const u=heap.pop();if(B.closed[u])continue;B.closed[u]=1;exp++;
    const x=B.x[u],y=B.y[u],th=B.th[u];if(viz.length<40000)viz.push(x,y);
    const dg=hyp(x-wp.x,y-wp.y);
    if(dg<0.25&&(goalTh==null||Math.abs(wrap(th-goalTh))<0.15)){fin=u;break;}
    // analytic expansion: try a Reeds–Shepp shot to the goal
    if(goalTh!=null&&(dg<2.5||exp%10===0)){
      shots++;const cs=RS.solve([x,y,th],q1,R);
      for(let ci=0;ci<Math.min(4,cs.length)&&!tail;ci++){
        const segs=RS.sample([x,y,th],cs[ci],R,SUB);let ok=true;
        for(const sg of segs){for(const p of sg.pts){if(clearAt(p[0],p[1],p[2])<MARG){ok=false;break;}}if(!ok)break;}
        if(ok)tail=segs;
      }
      if(tail){fin=u;break;}
    }
    for(const d of dirs)for(const st of steers){
      let nx=x,ny=y,nt=th,minC=Infinity,ok=true;const w=d*Math.tan(st)/L;
      for(let k=0;k<Math.round(STEP/SUB);k++){const n=integ(nx,ny,nt,d,w,SUB);nx=n.x;ny=n.y;nt=n.th;
        const c=clearAt(nx,ny,nt),need=(lenient&&B.g[u]<0.8)?Math.min(MARG,startClear-0.02):MARG;
        if(c<need){ok=false;break;}if(c<minC)minC=c;}
      if(!ok)continue;
      const v=key(nx,ny,nt);if(v<0||B.closed[v])continue;
      const prox=Math.max(0,(0.4-minC)/0.4);
      const cost=STEP*(d>0?1:P.revPen)+0.05*Math.abs(st)/dm+0.1*Math.abs(st-B.st[u])/dm+((B.dir[u]!==0&&B.dir[u]!==d)?P.gearPen:0)+STEP*2*prox*prox;
      const ng=B.g[u]+cost;
      if(ng<B.g[v]){B.g[v]=ng;B.par[v]=u;B.x[v]=nx;B.y[v]=ny;B.th[v]=nt;B.dir[v]=d;B.st[v]=st;heap.push(v,ng+P.eps*hAt(nx,ny,nt));}
    }
  }
  S.search={type:'hybrid',pts:viz};
  if(fin<0)return{ok:false,reason:exp>=BUDGET?`search budget of ${BUDGET} expansions used up`:'no kinematically feasible route',exp};
  // rebuild: re-simulate each primitive from its parent pose
  const chain=[];for(let k=fin;k!==s0&&k>=0;k=B.par[k])chain.push(k);chain.reverse();
  const segs=[];let cur=null;
  const add=(dir,pt)=>{if(!cur||cur.dir!==dir){const st=cur?cur.pts[cur.pts.length-1]:[e.x,e.y,e.th];cur={dir,pts:[st]};segs.push(cur);}cur.pts.push(pt);};
  for(const k of chain){const p=B.par[k],d=B.dir[k],w=d*Math.tan(B.st[k])/L;let nx=B.x[p],ny=B.y[p],nt=B.th[p];
    for(let i=0;i<Math.round(STEP/SUB);i++){const n=integ(nx,ny,nt,d,w,SUB);nx=n.x;ny=n.y;nt=n.th;add(d,[nx,ny,nt]);}}
  if(tail)for(const g of tail)for(let i=1;i<g.pts.length;i++)add(g.dir,g.pts[i]);
  if(!segs.length)segs.push({dir:1,pts:[[e.x,e.y,e.th],[e.x+1e-3*Math.cos(e.th),e.y+1e-3*Math.sin(e.th),e.th]]});
  let len=0;for(const g of segs)len+=pathLen(g.pts);
  return{ok:true,segs,len,exp,extra:`${segs.length-1} cusp${segs.length===2?'':'s'}${tail?' · RS shot':''}`};
}

/* ---------- path tracking helpers ---------- */""")

# ---------- track / plan ----------
rep("""function setTrack(pts){
  if(pts.length<2)pts=[pts[0],[pts[0][0]+1e-3,pts[0][1]]];
  const s=[0];for(let i=1;i<pts.length;i++)s.push(s[i-1]+hyp(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  S.track={pts,s,total:s[s.length-1],idx:0};S.pathId++;""",
"""function setPlan(segs){S.plan={segs};S.segIdx=0;loadSeg(0);}
function loadSeg(i){const g=S.plan.segs[i];setTrack(g.pts);S.track.dir=g.dir;S.ctlState={I:0,prev:null};}
function setTrack(pts){
  pts=pts.filter((p,i)=>i===0||hyp(p[0]-pts[i-1][0],p[1]-pts[i-1][1])>1e-4);
  if(pts.length<2)pts=[pts[0],[pts[0][0]+1e-3,pts[0][1]]];
  const s=[0];for(let i=1;i<pts.length;i++)s.push(s[i-1]+hyp(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  S.track={pts,s,total:s[s.length-1],idx:0,dir:1};S.pathId++;""")
rep("function pointAt(sArc){const T=S.track,p=T.pts;if(sArc>=T.total)return p[p.length-1];",
    "function pointAt(sArc,ext){const T=S.track,p=T.pts;if(sArc>=T.total){const b=p[p.length-1];if(!ext)return b;const a=p[p.length-2],l=hyp(b[0]-a[0],b[1]-a[1])||1,x=sArc-T.total;return[b[0]+(b[0]-a[0])/l*x,b[1]+(b[1]-a[1])/l*x];}")
s=s.replace("S.track=null","S.track=null;S.plan=null")

# ---------- doPlan ----------
rep("""  else if(P.plan==='astar')res=astar(e.x,e.y,wp.x,wp.y);
  else res=rrtstar(e.x,e.y,wp.x,wp.y);""","""  else if(P.plan==='astar')res=astar(e.x,e.y,wp.x,wp.y);
  else if(P.plan==='rs')res=rsPlan(e,wp);
  else if(P.plan==='hybrid')res=hybridAstar(e,wp);
  else res=rrtstar(e.x,e.y,wp.x,wp.y);""")
rep("const name={straight:'Straight',astar:'A*',rrtstar:'RRT*'}[P.plan];","const name=PLAN_NAMES[P.plan];")
rep("function doPlan(reason){","const PLAN_NAMES={straight:'Straight',astar:'A*',rrtstar:'RRT*',rs:'Reeds–Shepp',hybrid:'Hybrid A*'};\nfunction doPlan(reason){")
rep("""    setTrack(res.pts);F.state='DRIVE';""","""    setPlan(res.segs||[{pts:res.pts,dir:1}]);F.state='DRIVE';""")
rep("""    S.planStats={name,len:pathLen(res.pts),exp:res.exp,ms};
    if(reason!=='periodic')logE(`${reason==='initial'?'Plan':'Replan ('+reason+')'} · ${name} ${S.planStats.len.toFixed(1)} m${P.plan==='astar'?` · ${res.exp} expansions`:P.plan==='rrtstar'?` · ${res.exp} nodes`:''} · ${ms.toFixed(0)} ms`, reason==='initial'?'':'warn');""",
"""    S.planStats={name,len:res.len!=null?res.len:pathLen(res.pts),exp:res.exp,ms,extra:res.extra||''};
    if(reason!=='periodic')logE(`${reason==='initial'?'Plan':'Replan ('+reason+')'} · ${name} ${S.planStats.len.toFixed(1)} m${(P.plan==='astar'||P.plan==='hybrid')?` · ${res.exp} expansions`:P.plan==='rrtstar'?` · ${res.exp} nodes`:''}${res.extra?' · '+res.extra:''} · ${ms.toFixed(0)} ms`, reason==='initial'?'':'warn');""")

# ---------- mission: cusps, posed arrival, footprint blocked check ----------
rep("""  const wp=WPS[F.queue[0]],e=S.est;
  if(hyp(e.x-wp.x,e.y-wp.y)<ARRIVE){
    const te=hyp(S.robot.x-wp.x,S.robot.y-wp.y);
    logE(`Reached WP ${wpLabel(F.queue[0])} by estimate · true distance ${te.toFixed(2)} m`,te>0.5?'warn':'ok');""",
"""  const wp=WPS[F.queue[0]],e=S.est;
  let lastSeg=!S.plan||S.segIdx>=S.plan.segs.length-1;
  if(!lastSeg){
    const pr=project(e.x,e.y,true),T=S.track,end=T.pts[T.pts.length-1];
    if(T.total-pr.s<0.12||hyp(end[0]-e.x,end[1]-e.y)<0.1){
      S.segIdx++;loadSeg(S.segIdx);F.prog={t:S.t,x:e.x,y:e.y};
      logE(`Cusp → ${S.track.dir>0?'forward':'reverse'} (leg ${S.segIdx+1}/${S.plan.segs.length})`);
      lastSeg=S.segIdx>=S.plan.segs.length-1;
    }
  }
  const posed=isCar()&&wp.th!=null,headOK=!posed||Math.abs(wrap(e.th-wp.th))<0.35;
  if(lastSeg&&headOK&&hyp(e.x-wp.x,e.y-wp.y)<ARRIVE){
    const te=hyp(S.robot.x-wp.x,S.robot.y-wp.y),he=posed?Math.abs(deg(wrap(S.robot.th-wp.th))):0;
    logE(`Reached WP ${wpLabel(F.queue[0])} by estimate · true error ${te.toFixed(2)} m${posed?` · ${he.toFixed(0)}°`:''}`,(te>0.5||he>20)?'warn':'ok');""")
rep("""  if(P.plan!=='straight'&&S.t-F.lastBlockT>0.5){
    F.lastBlockT=S.t;const pr=project(e.x,e.y,true);""",
"""  if(P.plan==='hybrid'&&isCar()&&S.t-F.lastBlockT>0.5){
    // footprint check of the remaining legs (poses carry heading)
    F.lastBlockT=S.t;const pr=project(e.x,e.y,true);let trav=0,first=true;
    for(let gi=S.segIdx;gi<S.plan.segs.length&&trav<6;gi++){const pts=S.plan.segs[gi].pts;
      for(let i=(gi===S.segIdx?pr.i+2:1);i<pts.length&&trav<6;i++){trav+=hyp(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
        const c=fpClear(pts[i][0],pts[i][1],pts[i][2],S.cm.dist);if(c<0&&first)continue;first=false;
        if(c<0){F.state='PLAN';F.pendingReason='path blocked';return;}}}
  }
  else if(P.plan!=='straight'&&P.plan!=='rs'&&S.t-F.lastBlockT>0.5){
    F.lastBlockT=S.t;const pr=project(e.x,e.y,true);""")
