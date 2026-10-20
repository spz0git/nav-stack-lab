import asyncio, json, sys
from playwright.async_api import async_playwright
from _browser import launch, page_url
# Measures what the perception lessons' Try buttons show, headless: map quality against the truth (occupied-cell precision
# and recall over the cells the robot has seen), pose error, people contacts and closest approach, track velocity error,
# replans and mission progress; with people, the people predictors' mean error at 1 s and 2 s (constant velocity and,
# when a predictor model is built in, the learned one: core/predict.js), and the contacts and errors at the moment of
# Mission complete (goals: a Try's own goal list, set up as the Try button does); the people contacts made standing still (a walker reaching a stopped robot), the seconds the safety
# stop spent capping the speed and how close to a person it first did; and with the ultrasonic ring on, how its
# readings came back (echo, specular miss, dead zone, nothing in reach, crosstalk).
# With the radar or weather (P.radar, P.trkIn, P.weather): false tracks (confirmed tracks never within
# 1 m of a person), the speed planner's yields to them, stops with nobody within 2.5 m, the share of the time a person in
# the radar's field of view (within 8 m, in line of sight) has no confirmed track, the velocity error of tracks in that
# field in their first half second and after two seconds, how long a track takes to follow a person who turns around in
# that field (until its velocity is within 0.3 m/s of the person's), and the radar's detections per scan by what they are;
# 'radlog': true prints the radar's nearest detection ahead every half second (the moose test).
# A case: {name, lvl, seed, set, secs, every, goals, radlog}.
RUN=r'''
async ({lvl, seed, overrides, secs, every, goals, radlog}) => {
  const N=window.__nav; N.P.seed=seed;
  if(goals) await N.tryGo({sim:true, level:lvl, set:overrides, seed, goals, hold:true}); // as the Try button sets it up
  else{N.loadLevel(lvl); for(const [k,v] of Object.entries(overrides)) N.setParam(k,v,false);}
  document.querySelector('#run').click(); document.querySelector('#run').click();
  const S=N.S, LV=N.LV, rows=[]; let guardN=0,guardPed=null,sonSeen=-1,sonWhy={}; let vErrSum=0,vErrN=0,trkN=0,trkSamples=0,confMax=0,minClear=Infinity,done=null;
  const pe=()=>{const E=S.agents&&S.agents.pe;if(!E)return null;const m=(a,i)=>a[i+1]?+(a[i]/a[i+1]).toFixed(3):null;return{cv1:m(E.cv,0),cv2:m(E.cv,2),ln1:m(E.ln,0),ln2:m(E.ln,2),n:E.cv[1]};};
  // map quality with one cell of tolerance: an occupied map cell is right if the truth has an obstacle within one cell;
  // a seen truth obstacle cell is recalled if the map has an occupied cell within one cell
  const GW=240,GH=160,near=(A,i,pred)=>{const x=i%GW,y=(i/GW)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=GW||yy>=GH)continue;if(pred(A[yy*GW+xx]))return true;}return false;};
  const mapq=()=>{if(!S.lo)return null;const T=LV.truthOcc,L=S.lo;let tp=0,fp=0,fn=0,seen=0,occ=0;
    for(let i=0;i<L.length;i++){const l=L[i];if(Math.abs(l)<0.05)continue;seen++;
      if(l>0.5){occ++;if(near(T,i,v=>v>0))tp++;else fp++;}
      if(T[i]>0&&!near(L,i,v=>v>0.5))fn++;}
    return{seen,occ,prec:occ?+(tp/occ).toFixed(2):null,rec:(tp+fn)?+(tp/(tp+fn)).toFixed(2):null,fp,fn};};
  // the radar and weather measures (see the header)
  const RD={turns:[],pv:new Map(),idStat:{},first:{},inView:0,lost:0,young:[0,0],old:[0,0],scans:0,kinds:{},stopT:0,log:[]};
  const losFree=(e,p)=>{const d=Math.hypot(p.x-e.x,p.y-e.y),n=Math.ceil(d/0.05);for(let k=1;k<n-6;k++){const x=e.x+(p.x-e.x)*k/n,y=e.y+(p.y-e.y)*k/n;if(S.shapes.some(q=>q.t==='r'?x>=q.x&&x<=q.x+q.w&&y>=q.y&&y<=q.y+q.h:Math.hypot(x-q.x,y-q.y)<=q.r))return false;}return true;};
  const radStep=()=>{const e=S.est,A=S.agents;if(!A)return;
    for(const t of A.tracks)if(RD.first[t.id]==null)RD.first[t.id]=S.t;
    const conf=A.tracks.filter(t=>t.conf);
    for(const t of conf){let best=null;for(const p of S.peds){const d=Math.hypot(p.x-t.x,p.y-t.y);if(d<1&&(!best||d<best[0]))best=[d,p];}
      const st=RD.idStat[t.id]=RD.idStat[t.id]||[0,0];st[best?0:1]++;
      const d=Math.hypot(t.x-e.x,t.y-e.y),b=Math.abs(Math.atan2(Math.sin(Math.atan2(t.y-e.y,t.x-e.x)-e.th),Math.cos(Math.atan2(t.y-e.y,t.x-e.x)-e.th)));
      if(best&&d<8&&b<Math.PI/3){const age=S.t-RD.first[t.id],ev=Math.hypot(t.vx-(best[1].vx||0),t.vy-(best[1].vy||0));if(age<0.5){RD.young[0]+=ev;RD.young[1]++;}else if(age>2){RD.old[0]+=ev;RD.old[1]++;}}}
    for(const p of S.peds){const d=Math.hypot(p.x-e.x,p.y-e.y),a=Math.atan2(p.y-e.y,p.x-e.x)-e.th,b=Math.abs(Math.atan2(Math.sin(a),Math.cos(a)));
      if(d>8||b>Math.PI/3||!losFree(e,p))continue;RD.inView++;if(!conf.some(t=>Math.hypot(p.x-t.x,p.y-t.y)<1))RD.lost++;}
    if(S.fsm.state==='DRIVE'&&Math.abs(S.robot.v)<0.05&&!S.peds.some(p=>Math.hypot(p.x-S.robot.x,p.y-S.robot.y)<2.5))RD.stopT+=0.1;
    for(const p of S.peds){const o=RD.pv.get(p),sp=Math.hypot(p.vx||0,p.vy||0);
      if(o&&o[0]*p.vx+o[1]*p.vy<0&&sp>0.3){const d=Math.hypot(p.x-e.x,p.y-e.y),a=Math.atan2(p.y-e.y,p.x-e.x)-e.th;if(d<8&&Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))<Math.PI/3)RD.turns.push({p,t0:S.t,done:null,seen:false,cos:+((p.vx*(p.x-e.x)+p.vy*(p.y-e.y))/(sp*d)).toFixed(2),d:+d.toFixed(1)});}
      if(sp>0.3)RD.pv.set(p,[p.vx,p.vy]);}
    for(const E of RD.turns){if(E.done!=null||S.t-E.t0>3)continue;const t=conf.find(t=>Math.hypot(t.x-E.p.x,t.y-E.p.y)<1);if(!t)continue;E.seen=true;if(Math.hypot(t.vx-E.p.vx,t.vy-E.p.vy)<0.3)E.done=+(S.t-E.t0).toFixed(2);}
    if(S.radar&&S.radar.t===S.t){RD.scans++;for(const d of S.radar.det)RD.kinds[d.kind]=(RD.kinds[d.kind]||0)+1;}};
  const per=Math.round(every/0.05),total=Math.round(secs/every);
  for(let i=0;i<total;i++){
    for(let j=0;j<per;j++){await N.advance(1);if(S.tick%2===1)radStep();if(radlog&&S.tick%10===1&&S.radar){const a=S.radar.det.filter(d=>Math.abs(d.b)<0.35).sort((x,y)=>x.r-y.r)[0];RD.log.push([+S.t.toFixed(2),+S.robot.x.toFixed(2),+S.robot.v.toFixed(2),a?+a.r.toFixed(2):null,a?+a.v.toFixed(2):null,a&&a.v<-0.05?+(a.r/-a.v).toFixed(2):null,S.coll]);}if(S.guard){guardN++;if(guardPed==null&&S.peds.length)guardPed=+Math.min(...S.peds.map(p=>Math.hypot(p.x-S.robot.x,p.y-S.robot.y)-p.r-0.3)).toFixed(2);}if(S.sonArcs&&S.sonTick===S.tick&&S.sonTick!==sonSeen){sonSeen=S.sonTick;for(const A of S.sonArcs)if(A&&A.t>S.t-0.051)sonWhy[A.why]=(sonWhy[A.why]||0)+1;}if(!done&&S.fsm.state==='DONE')done={t:+S.t.toFixed(1),ped:S.collPed,coll:S.coll,minPed:+S.minPed.toFixed(2),pe:pe()};{const k=N.cellIdx?N.cellIdx(S.robot.x,S.robot.y):-1;}{const i=Math.floor(S.robot.x/0.1),jj=Math.floor(S.robot.y/0.1);if(i>=0&&jj>=0&&i<GW&&jj<GH)minClear=Math.min(minClear,LV.truthDist[jj*GW+i]-0.3);}
      if(S.agents&&S.agents.tracks){const tr=S.agents.tracks.filter(t=>t.conf);confMax=Math.max(confMax,tr.length);
        if(S.tick%10===0)for(const t of tr){let best=null;for(const p of S.peds){const d=Math.hypot(p.x-t.x,p.y-t.y);if(d<1&&(!best||d<best[0]))best=[d,p];}
          if(best){vErrSum+=Math.hypot((best[1].vx||0)-t.vx,(best[1].vy||0)-t.vy);vErrN++;}}}}
    const r=S.robot,e=S.est,err=Math.hypot(r.x-e.x,r.y-e.y);
    const nees=S.nees.length?S.nees.reduce((a,b)=>a+b,0)/S.nees.length:null;
    const row={t:+S.t.toFixed(0),err:+err.toFixed(2),nees:nees==null?null:+nees.toFixed(1),st:S.fsm.state,done:N.WPS.filter(w=>w.done&&!w.skipped).length,skip:N.WPS.filter(w=>w.skipped).length,coll:S.coll,ped:S.collPed,still:S.collPedStill||0,guardS:+(guardN*0.05).toFixed(1),minPed:isFinite(S.minPed)?+S.minPed.toFixed(2):null,replans:S.log.filter(l=>/^Replan/.test(l.msg)).length};
    const m=mapq();if(m)Object.assign(row,m);
    if(N.P.per==='mapping'){const f=N.exploredFrac();if(f!=null)row.floor=Math.round(100*f);} // the Metrics panel's Floor seen [%]
    if(S.pf)row.inj=+(S.pf.inj).toFixed(2);
    rows.push(row);}
  const ids=Object.values(RD.idStat),fakeIds=new Set(Object.entries(RD.idStat).filter(([,v])=>v[1]>v[0]).map(([k])=>k));
  const rad={falseTracks:fakeIds.size,tracks:ids.length,falseYields:S.log.filter(l=>{const m=/yielding to agent #(\d+)/.exec(l.msg);return m&&fakeIds.has(m[1]);}).length,
    yields:S.log.filter(l=>/yielding/.test(l.msg)).length,stopNobody:+RD.stopT.toFixed(1),aheadUntracked:RD.inView?+(RD.lost/RD.inView).toFixed(2):null,
    vYoung:RD.young[1]?+(RD.young[0]/RD.young[1]).toFixed(2):null,vOld:RD.old[1]?+(RD.old[0]/RD.old[1]).toFixed(2):null,nYoung:RD.young[1],
    turns:RD.turns.filter(E=>E.seen).map(E=>[+E.t0.toFixed(1),E.done,E.cos,E.d]),perScan:RD.scans?Object.fromEntries(Object.entries(RD.kinds).map(([k,v])=>[k,+(v/RD.scans).toFixed(2)])):null,log:RD.log};
  return{rad,rows,done,pe:pe(),guardPed,sonWhy,vErr:vErrN?+(vErrSum/vErrN).toFixed(2):null,confMax,dist:+S.dist.toFixed(1),minClear:isFinite(minClear)?+minClear.toFixed(2):null,
    log:S.log.filter(l=>/A\*|Replan|yield|Skipping|contact|Collision|walked into|Paused/i.test(l.msg)).slice(0,14).map(l=>l.t.toFixed(1)+' '+l.msg).reverse()};
}'''
async def main():
    cases=json.loads(sys.argv[1])
    async with async_playwright() as p:
        b=await launch(p)
        pg=await b.new_page(viewport={'width':1280,'height':900})
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto(page_url())
        await pg.wait_for_timeout(800)
        for c in cases:
            r=await pg.evaluate(RUN,{'lvl':c['lvl'],'seed':c.get('seed',7),'overrides':c.get('set',{}),'secs':c.get('secs',150),'every':c.get('every',10),'goals':c.get('goals'),'radlog':c.get('radlog',False)})
            print('==',c.get('name',''),'L%d'%(c['lvl']+1),'seed',c.get('seed',7),c.get('set',{}),'vErr',r['vErr'],'confMax',r['confMax'],'dist',r['dist'],'minClear',r['minClear'],'guard first at',r['guardPed'],'m from a person','sonar',r['sonWhy'])
            print('   prediction error (m, at 1 s / 2 s; cv1 cv2 ln1 ln2):',r['pe'],'· at Mission complete:',r['done'])
            rd=r['rad']; log=rd.pop('log')
            print('   radar and weather:',rd)
            for q in log: print('      radar ahead (t, x, v, range, radial v, ttc, collisions):',q)
            for row in r['rows']: print('   ',row)
            for l in r['log']: print('      ',l)
        print('ERRORS:',errs[:5])
        await b.close()
asyncio.run(main())
