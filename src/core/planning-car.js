
/* ---------- Reeds–Shepp only (ignores obstacles) ---------- */
function rsPlan(e,wp){
  const R=planR(),th=wp.th!=null?wp.th:Math.atan2(wp.y-e.y,wp.x-e.x);
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
  const dist=S.cm.dist,L=P.wheelbase,dm=planSteer(),R=planR(),MARG=0.15,STEP=0.4,SUB=0.1,BUDGET=60000;
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
    if(dg<0.15&&(goalTh==null||Math.abs(wrap(th-goalTh))<0.12)){fin=u;break;}   // inside the arrival tolerance
    // analytic expansion: try a Reeds–Shepp shot to the goal
    if(goalTh!=null&&(dg<2.5||exp%10===0)){
      shots++;const cs=RS.solve([x,y,th],q1,R);
      for(let ci=0,tried=0;ci<cs.length&&tried<4&&!tail;ci++){
        // reject shots with gear legs too short to execute (< 0.25 m)
        let short=false,acc=0,sg0=0;for(const d of cs[ci].L){const sg=Math.sign(d);if(Math.abs(d)<1e-9)continue;if(sg!==sg0&&sg0!==0){if(acc<0.25)short=true;acc=0;}sg0=sg;acc+=Math.abs(d)*R;}if(acc<0.25&&cs[ci].len*R>0.25)short=true;
        if(short)continue;tried++;
        const segs=RS.sample([x,y,th],cs[ci],R,SUB);let ok=true;
        for(const sg of segs){for(const p of sg.pts){if(clearAt(p[0],p[1],p[2])<MARG){ok=false;break;}}if(!ok)break;}
        if(ok)tail=segs;
      }
      if(tail){fin=u;break;}
    }
    for(const d of dirs)for(const st of steers){
      let nx=x,ny=y,nt=th,minC=Infinity,ok=true;const w=d*Math.tan(st)/L;
      for(let k=0;k<Math.round(STEP/SUB);k++){const n=integ(nx,ny,nt,d,w,SUB);nx=n.x;ny=n.y;nt=n.th;
        const c=clearAt(nx,ny,nt),need=(lenient&&hyp(nx-e.x,ny-e.y)<1.0)?Math.min(MARG,startClear-0.1):MARG;   // let a car that is touching something back out
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
