import asyncio, json, sys
from playwright.async_api import async_playwright
from _browser import launch, page_url
# Measures agent detection and tracking headless, per scan against the truth: beam-level precision and recall of the
# learned detector (beams whose hit lies on a person), detection-level precision and recall (a detection within 0.5 m
# of a true person; a person counts as detectable when at least one beam hits it), the RMS velocity error of the
# confirmed tracks against the person they sit on, contacts and goals. A case: {name, lvl, set, secs}.
#   python3 measure_det.py '[{"name":"learned","lvl":4,"set":{"agents":"learned","spd":"st"},"secs":120}]'
RUN=r'''
async ({lvl, overrides, secs}) => {
  const N=window.__nav; N.setParam('seed',7,false); N.loadLevel(lvl);
  for(const [k,v] of Object.entries(overrides)) N.setParam(k,v,false);
  document.querySelector('#run').click(); document.querySelector('#run').click();
  const S=N.S, NB=120, LMAX=8; let tpB=0,fpB=0,fnB=0, tpD=0,fpD=0,fnD=0, ve=0,vn=0, scans=0, lastTick=-1;
  const total=Math.round(secs/0.05);
  for(let i=0;i<total;i++){ await N.advance(1); if(S.fsm.state==='DONE') break;
    if(S.scanTick!==S.tick||S.scanTick===lastTick) continue; lastTick=S.scanTick; scans++;
    const r=S.scan, rb=S.robot, A=S.agents; const lab=new Uint8Array(NB); const seen=new Set();
    for(let k=0;k<NB;k++){ if(r[k]>=LMAX-1e-3) continue; const a=rb.th-Math.PI+k*2*Math.PI/NB, hx=rb.x+r[k]*Math.cos(a), hy=rb.y+r[k]*Math.sin(a);
      S.peds.forEach((p,j)=>{ if(!lab[k] && Math.hypot(p.x-hx,p.y-hy)<=p.r+0.12){ lab[k]=1; seen.add(j);} }); }
    if(A&&A.beamP){ for(let k=0;k<NB;k++){ const pr=A.beamP[k]>0.5?1:0; if(pr&&lab[k])tpB++; else if(pr&&!lab[k])fpB++; else if(!pr&&lab[k])fnB++; } }
    if(A&&A.det){ const used=new Set(); for(const d of A.det){ let ok=false; S.peds.forEach((p,j)=>{ if(!ok && Math.hypot(p.x-d.x,p.y-d.y)<0.5){ ok=true; used.add(j);} }); if(ok)tpD++; else fpD++; }
      for(const j of seen) if(!used.has(j)) fnD++; }
    if(A&&A.tracks) for(const t of A.tracks){ if(!t.conf) continue; let best=null,bd=0.6; for(const p of S.peds){ const d=Math.hypot(p.x-t.x,p.y-t.y); if(d<bd){bd=d;best=p;} }
      if(best){ ve+=(t.vx-(best.vx||0))**2+(t.vy-(best.vy||0))**2; vn++; } }
  }
  const f=(a,b)=>b?+(a/b).toFixed(3):null;
  return {t:+S.t.toFixed(1), scans, beamP:f(tpB,tpB+fpB), beamR:f(tpB,tpB+fnB), detP:f(tpD,tpD+fpD), detR:f(tpD,tpD+fnD), nDet:tpD+fpD, velRMS:vn?+Math.sqrt(ve/vn).toFixed(3):null, trackSamples:vn,
    ped:S.collPed, coll:S.coll, done:N.WPS.filter(w=>w.done&&!w.skipped).length, icp:(S.agents&&S.agents.tracks||[]).reduce((a,t)=>a+(t.icp||0),0)};
}'''
async def main():
    cases=json.loads(sys.argv[1])
    async with async_playwright() as p:
        b=await launch(p); pg=await b.new_page(viewport={'width':1280,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto(page_url()); await pg.wait_for_timeout(800)
        for c in cases:
            r=await pg.evaluate(RUN,{'lvl':c['lvl'],'overrides':c.get('set',{}),'secs':c.get('secs',120)})
            print('==',c.get('name',''),'L%d'%(c['lvl']+1),c.get('set',{}),r)
        print('ERRORS:',errs[:5]); await b.close()
asyncio.run(main())
