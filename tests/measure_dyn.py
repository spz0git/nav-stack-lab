import asyncio, json, os, sys
from playwright.async_api import async_playwright
# Measures what the car-with-tyre-slip lessons' Try buttons show, headless, by pressing the button's cfg exactly.
# A case: {name, cfg, secs} — cfg with sim:true runs in the simulator (tryGo) for secs and reports the run:
#   goals, time, collisions, cross-track RMS and max, the largest a_y and its share of μg, the time spent above 0.8 μg
#   (the health light's rule), β max, steering at its lock, yaw rate against v tanδ / L where the car turns
#   (|r_kin| > 0.2 rad/s), and the dead-reckoning heading drift when the estimator is dead reckoning;
# otherwise it is an Analyze lesson cfg (lessonGo) and reports the loop numbers, as tests/tles.py does.
# Usage (from tests/, after ./build.sh): python3 measure_dyn.py '[{"name":…,"cfg":{…},"secs":60}, …]'
#        or a control lesson's buttons: python3 measure_dyn.py '[{"lesson":"Running out of grip","secs":120}]'
SIM=r'''
async ({cfg, secs}) => {
  const N=window.__nav; await N.tryGo(cfg); document.querySelector('#run').click();   // as the button does, then pause
  const S=N.S,P=N.P,dyn=P.carPhys==='dyn'&&P.model==='car',mug=P.mu*9.81,lock=P.steerMaxDeg*Math.PI/180*0.97;
  let n=0,fsat=0,ayMax=0,hot=0,beta=0,sat=0,cteMax=0,turn=0,ratio=0,lagMax=0,warn=0;
  for(let i=0;i<Math.round(secs/0.05);i++){await N.advance(1);const r=S.robot;n++;
    if(Math.abs(r.d)>=lock&&S.fsm.state==='DRIVE')sat++;
    if(dyn){const q=N.dynSlip(r),ay=Math.abs(q.ay),lf=P.lf,L=P.wheelbase;if(Math.abs(q.Ff)>=0.999*P.mu*P.mass*9.81*(L-lf)/L&&S.fsm.state==='DRIVE')fsat++;ayMax=Math.max(ayMax,ay);if(ay>0.8*mug)hot++;beta=Math.max(beta,Math.abs(q.beta));
      if(Math.abs(r.wk)>0.2&&Math.abs(r.v)>0.3){turn++;ratio+=r.r/r.wk;}}
    if(i%10===0&&N.health().ctl[0]==='warn')warn++;
    const last=S.plot[S.plot.length-1];if(last&&last.cte!=null)cteMax=Math.max(cteMax,Math.abs(last.cte));
    if(S.fsm.state==='DONE')break;}
  const e=S.est,r=S.robot;
  return {t:+S.t.toFixed(1),state:S.fsm.state,goals:N.WPS.filter(w=>w.done&&!w.skipped).length+'/'+N.WPS.length,coll:S.coll,ped:S.collPed,
    cteRMS:S.cteN?+Math.sqrt(S.cteSq/S.cteN).toFixed(3):null,cteMax:+cteMax.toFixed(2),dist:+S.dist.toFixed(1),
    ayMax:+ayMax.toFixed(2),ayMaxPct:+(100*ayMax/mug).toFixed(0),hotPct:+(100*hot/n).toFixed(1),frontSatPct:+(100*fsat/n).toFixed(1),betaMax:+(beta*180/Math.PI).toFixed(1),
    lockPct:+(100*sat/n).toFixed(1),rOverRkin:turn?+(ratio/turn).toFixed(3):null,warnPct:+(100*warn/Math.ceil(n/10)).toFixed(0),
    poseErr:+Math.hypot(r.x-e.x,r.y-e.y).toFixed(2),headErr:+(Math.abs(((r.th-e.th+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI)*180/Math.PI).toFixed(1),
    log:S.log.filter(l=>/Collision|Replan|skip|Contact/i.test(l.msg)).slice(0,6).map(l=>l.t.toFixed(1)+' '+l.msg).reverse()};
}'''
AN=r'''
async ({cfg}) => {
  const A=window.__an,N=window.__nav;A.lessonGo(cfg);
  for(let k=0;k<400&&A.AN.busy;k++)await new Promise(r=>setTimeout(r,50));
  const R=A.AN.res,F=R.F||{},M=R.M,ms=A.AN.meas.step,sm=ms?A.stepMetrics(ms.data,ms.kind):null,D=M.dyn;
  const Gr=D?D.nr[0]/D.det[0]:M.g,f=x=>x==null?null:+x.toFixed(3);
  return {v0:M.v0,ctl:M.ctl,dyn:!!D,Ke:f(M.Ke),Kth:f(M.Kth),Gr0:f(Gr),vOverL:f(M.g),ratio:f(Gr/M.g),stable:R.stable,PM:f(F.pm),GM:f(F.gm),wc:f(F.wc),DM:f(F.dm),Ms:f(F.ms),
    zeta:f(R.zeta),wn:f(R.wn),OS:f(R.smOff&&R.smOff.overshoot),settle:f(R.smOff&&R.smOff.settle),essBias:f(R.smBias&&R.smBias.final),
    meas:sm?Object.fromEntries(Object.entries(sm).map(([k,v])=>[k,f(v)])):null,sat:ms&&ms.satT,olp:R.olp.filter(p=>Math.hypot(p[0],p[1])>1e-6).map(p=>p.map(x=>+x.toFixed(2)))};
}'''
async def main():
    cases=json.loads(sys.argv[1])
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        pg=await b.new_page(viewport={'width':1280,'height':900});errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto('file://'+os.path.abspath('wrapped.html'));await pg.wait_for_timeout(800)
        expanded=[]
        for c in cases:   # {"lesson": title} expands to every Try button of that control lesson, pressed exactly
            if 'lesson' in c:
                tr=await pg.evaluate("t=>{const A=window.__an,L=A.LESSONS.concat(A.LESSONS_EXTRA).find(x=>x.t===t);return L?L.tries.map(x=>[x[0],x[1]]):[];}",c['lesson'])
                expanded+=[{'name':f"{c['lesson'][:28]} · {lbl}",'cfg':cfg,'secs':c.get('secs',120)} for lbl,cfg in tr]
            else: expanded.append(c)
        for c in expanded:
            sim=c['cfg'].get('sim')
            r=await pg.evaluate(SIM if sim else AN,{'cfg':c['cfg'],'secs':c.get('secs',60)})
            log=r.pop('log',None)
            print('==',c.get('name',''),json.dumps(c['cfg'].get('set',{})),'\n   ',r)
            for l in log or []: print('      ',l)
        print('ERRORS:',errs[:5])
        await b.close()
asyncio.run(main())
