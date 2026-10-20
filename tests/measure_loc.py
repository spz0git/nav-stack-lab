import asyncio, json, sys
from playwright.async_api import async_playwright
from _browser import launch, page_url
# Measures what the localization lessons' Try buttons show, headless: pose error, filter σ, NEES, rejected readings,
# particle-filter N_eff and injections over time. A case: {name, lvl, set, secs, every, act, dense}.
# act 'kidnap' or 'scatter' happens after 8 s (as tryGo does); dense = seconds sampled every second after the act;
# tour: the level's goals and then back to its start (a loop for pose-graph SLAM to close); 'back': out along the goals and
# back along them to the first (the lesson's tour); goals: a Try's own goal list (set up as the Try button does).
# The car levels (L6, L7) run the same way; goals may carry a heading ([x, y, θ]). With GNSS on, each row adds the fixes
# so far (gn), fused (gu), gated (gg), resets after a run of gated fixes (gr), the share of fixes inside multipath (mp), the last fix's error against the truth
# (gerr) and, with the bias in the EKF state, the estimated and the true bias (gb, gbt); the summary adds the true
# position error's RMS while driving (drvRMS) and the windowed NEES's largest value (neesMax).
RUN=r'''
async ({lvl, overrides, secs, every, act, dense, tour, goals, seed}) => {
  const N=window.__nav; N.P.seed=seed||7;
  if(goals) await N.tryGo({sim:true, level:lvl, set:overrides, goals, hold:true, seed:seed||7});
  else if(tour){const L=N.LEVELS[lvl]; await N.tryGo({sim:true, level:lvl, set:overrides, goals:tour==='back'?L.wps.map(w=>[w[0],w[1]]).concat(L.wps.slice(0,-1).reverse().map(w=>[w[0],w[1]])):L.wps.map(w=>[w[0],w[1]]).concat([[L.start[0],L.start[1]]]), hold:true, seed:seed||7});}
  else{N.loadLevel(lvl); for(const [k,v] of Object.entries(overrides)) N.setParam(k,v,false);}
  document.querySelector('#run').click(); document.querySelector('#run').click();
  const S=N.S, rows=[]; let inside=0,n=0,t0=0,neesMax=0,dSq=0,dN=0;
  const samp=()=>{const r=S.robot,e=S.est,err=Math.hypot(r.x-e.x,r.y-e.y);
    const s=S.Pc?Math.sqrt(Math.max(0,S.Pc[0]+S.Pc[4])):null;
    const nees=S.nees.length?S.nees.reduce((a,b)=>a+b,0)/S.nees.length:null;
    const dth=Math.abs(((r.th-e.th+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI)*180/Math.PI;
    const row={t:+S.t.toFixed(1),err:+err.toFixed(2),dth:+dth.toFixed(0),sig:s==null?null:+s.toFixed(2),nees:nees==null?null:+nees.toFixed(1),rej:S.rejected||0,st:S.fsm.state,done:N.WPS.filter(w=>w.done&&!w.skipped).length,skip:N.WPS.filter(w=>w.skipped).length,coll:S.coll};
    if(S.pf){row.neff=Math.round(S.pf.neff);row.inj=S.pf.inj;row.wf=+S.pf.wfast.toFixed(3);row.ws=+S.pf.wslow.toFixed(3);}
    if(S.slam&&S.slam.lm)row.lms=S.slam.lm.length;
    if(S.pg){row.kf=S.pg.nodes.length;row.loops=S.pg.loops;row.mt=S.pg.matched;if(S.pg.opt)row.opt=+S.pg.opt.ms.toFixed(0);row.optMax=+(S.pg.optMax||0).toFixed(0);}
    if(N.P.per==='mapping'){const a=N.mapAgree();if(a!=null)row.map=+(100*a).toFixed(0);}
    if(S.gnss){const G=S.gnss,F=G.fixes;row.gn=G.n;row.gu=G.used;row.gg=G.gated;if(G.resets)row.gr=G.resets;row.mp=F.length?+(F.filter(f=>f.mp).length/F.length).toFixed(2):0;
      if(G.last)row.gerr=+Math.hypot(G.last.x-S.robot.x,G.last.y-S.robot.y).toFixed(2);
      if(S.gb){row.gb=[+S.gb.b[0].toFixed(2),+S.gb.b[1].toFixed(2)];row.gbt=[+G.bx.toFixed(2),+G.by.toFixed(2)];}}
    if(row.nees!=null)neesMax=Math.max(neesMax,row.nees);
    rows.push(row);};
  const step=async(secsRun,evry)=>{const total=Math.round(secsRun/evry),per=Math.round(evry/0.05);
    for(let i=0;i<total;i++){for(let j=0;j<per;j++){await N.advance(1);const r=S.robot,e=S.est,err=Math.hypot(r.x-e.x,r.y-e.y);
      if(S.Pc){const s=Math.sqrt(Math.max(0,S.Pc[0]+S.Pc[4]));n++;if(err<2*s)inside++;}
      if(S.fsm.state==='DRIVE'){dSq+=err*err;dN++;}}samp();}};
  if(act){await N.advance(160);samp();if(act==='kidnap')N.kidnapTo(null);else N.scatter();samp();await step(dense||20,1);await step(secs-8-(dense||20),every);}
  else await step(secs,every);
  return {rows, drvRMS:dN?+Math.sqrt(dSq/dN).toFixed(2):null, neesMax:+neesMax.toFixed(1), inside2s:n?+(inside/n).toFixed(2):null, poseRMS:S.errN?+Math.sqrt(S.errSq/S.errN).toFixed(2):null, errMax:+Math.max(...rows.map(r=>r.err)).toFixed(2),
    log:S.log.filter(l=>/kidnap|Scatter|inject|Replan|skip|lost/i.test(l.msg)||(/Loop closure/.test(l.msg)&&(/wide search/.test(l.msg)||+(/correction (\d+) cm/.exec(l.msg)||[0,0])[1]>=30))).slice(0,16).map(l=>l.t.toFixed(1)+' '+l.msg).reverse()};
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
            r=await pg.evaluate(RUN,{'lvl':c['lvl'],'overrides':c.get('set',{}),'secs':c.get('secs',150),'every':c.get('every',10),'act':c.get('act'),'dense':c.get('dense'),'tour':c.get('tour'),'goals':c.get('goals'),'seed':c.get('seed',7)})
            print('==',c.get('name',''),'L%d'%(c['lvl']+1),'seed',c.get('seed',7),c.get('set',{}),c.get('act',''),'inside2σ',r['inside2s'],'poseRMS',r['poseRMS'],'drvRMS',r['drvRMS'],'errMax',r['errMax'],'neesMax',r['neesMax'])
            for row in r['rows']: print('   ',row)
            for l in r['log']: print('      ',l)
        print('ERRORS:',errs[:5])
        await b.close()
asyncio.run(main())
