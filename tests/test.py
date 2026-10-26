# The L1–L5 regression through the page (click wiring, the UI's advance): the 14 cases of tests/node/core.mjs (CASES),
# each run printed, and the fields the page shares with the Node golden file asserted against tests/node/golden.json
# (NAV_LAB_GOLDEN=path for another file) with the golden test's tolerances; a mismatch goes into ERRORS. Then the
# kidnap check. ERRORS: [] when everything held (exit 1 otherwise).
import asyncio, json, os, sys
from playwright.async_api import async_playwright
from _browser import launch, page_url, HERE
GOLDEN=os.environ.get('NAV_LAB_GOLDEN') or os.path.join(HERE,'node','golden.json')
# FIELDS of tests/node/core.mjs: None is exact, a number the largest difference allowed.
TOL={'state':None,'goalsDone':None,'goals':None,'skipped':None,'coll':None,'ped':None,'replans':None,'t':0.1,'dist':0.05,'poseRMS':0.002,'cteRMS':0.002,'nees':0.05}
def golden_diffs(got,want):
    out=[]
    for k,tol in TOL.items():
        g,w=got.get(k),want.get(k)
        if tol is None or g is None or w is None:
            if g!=w: out.append(f'{k}: {g} ≠ {w}')
        elif abs(g-w)>tol: out.append(f'{k}: {g} ≠ {w} (±{tol})')
    return out
TEST=r'''
async ({lvl, overrides, secs}) => {
  const N=window.__nav; N.loadLevel(lvl);
  for(const [k,v] of Object.entries(overrides)) N.setParam(k,v,false);
  const t0=performance.now();
  // start mission
  document.querySelector('#run').click(); document.querySelector('#run').click(); // run then pause (starts mission)
  await N.advance(Math.round(secs/0.05));
  const S=N.S; const r=S.robot,e=S.est;
  return {lvl, state:S.fsm.state, t:S.t.toFixed(1), done:N.WPS.filter(w=>w.done&&!w.skipped).length+'/'+N.WPS.length,
    skipped:N.WPS.filter(w=>w.skipped).length, coll:S.coll, ped:S.collPed, err:Math.hypot(r.x-e.x,r.y-e.y).toFixed(2),
    nees: S.nees.length? (S.nees.reduce((a,b)=>a+b,0)/S.nees.length).toFixed(1):null, wall:(performance.now()-t0).toFixed(0)+'ms',
    log:S.log.slice(0,8).map(l=>l.t.toFixed(1)+' '+l.msg).reverse(),
    // the golden fields, rounded as the worker's runSummary rounds them (src/worker/main.js)
    golden:{state:S.fsm.state, goalsDone:N.WPS.filter(w=>w.done&&!w.skipped).length, goals:N.WPS.length,
      skipped:N.WPS.filter(w=>w.skipped).length, coll:S.coll, ped:S.collPed,
      replans:S.log.filter(l=>/^Replan/.test(l.msg)).length, t:+S.t.toFixed(2), dist:+S.dist.toFixed(2),
      poseRMS:S.errN? +Math.sqrt(S.errSq/S.errN).toFixed(4):null, cteRMS:S.cteN? +Math.sqrt(S.cteSq/S.cteN).toFixed(4):null,
      nees:S.nees.length? +(S.nees.reduce((a,b)=>a+b,0)/S.nees.length).toFixed(2):null}};
}'''
KIDNAP=r'''
async ({lvl, overrides}) => {
  const N=window.__nav; N.loadLevel(lvl);
  for(const [k,v] of Object.entries(overrides)) N.setParam(k,v,false);
  document.querySelector('#run').click(); document.querySelector('#run').click();
  await N.advance(100);
  const S=N.S, kt=S.t; N.kidnapTo(null);
  for(let i=0;i<40;i++){await N.advance(1);
    const l=S.log.find(l=>l.t>kt&&/^(Replan|Plan|Reached)/.test(l.msg));
    if(l)return (l.t-kt).toFixed(2)+' s → '+l.msg.split(' · ')[0];}
  return 'no replan within 2 s';
}'''
async def main():
    async with async_playwright() as p:
        b=await launch(p)
        pg=await b.new_page(viewport={'width':1280,'height':900})
        errs=[]; golden=json.load(open(GOLDEN))
        pg.on('console', lambda m: errs.append(m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto(page_url())
        await pg.wait_for_timeout(800)
        cases=[(0,{},90),(0,{'ctl':'pid'},90),(0,{'ctl':'dwa'},90),(1,{},120),(1,{'plan':'rrtstar'},120),(1,{'plan':'straight'},60),(1,{'mis':'optimal'},120),
               (2,{},150),(2,{'loc':'ekf'},150),(2,{'loc':'pf'},150),(3,{},200),(3,{'unknownAs':'lethal'},200),(4,{},200),(4,{'ctl':'dwa'},200)]
        for lvl,ov,secs in cases:
            r=await pg.evaluate(TEST,{'lvl':lvl,'overrides':ov,'secs':secs})
            print(lvl+1,ov,{k:v for k,v in r.items() if k not in ('log','golden')})
            for l in r['log']: print('     ',l)
            label=f"L{lvl+1} {json.dumps(ov,separators=(',',':'))} {secs}s"  # caseLabel in tests/node/core.mjs
            if label not in golden: errs.append(f'{label}: not in {GOLDEN}')
            else: errs+=[f'{label} differs from golden.json: {d}' for d in golden_diffs(r['golden'],golden[label])]
        # kidnap mid-mission: the plan must follow the estimate at once, not after the next goal
        for lvl,ov in [(1,{}),(5,{})]:
            r=await pg.evaluate(KIDNAP,{'lvl':lvl,'overrides':ov})
            print('kidnap',lvl+1,ov,r)
        print('ERRORS:',errs[:10])
        await b.close()
        return errs
sys.exit(1 if asyncio.run(main()) else 0)
