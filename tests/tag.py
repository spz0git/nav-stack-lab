import asyncio, sys, json, os
from playwright.async_api import async_playwright
TEST=r'''
async ({lvl, overrides, secs}) => {
  const N=window.__nav; if(overrides.seed){N.P.seed=overrides.seed;} N.loadLevel(lvl);
  for(const [k,v] of Object.entries(overrides)) if(k!=='seed')N.setParam(k,v,false);
  const t0=performance.now();
  document.querySelector('#run').click(); document.querySelector('#run').click();
  let tDone=null;
  for(let i=0;i<Math.round(secs/0.05);i+=20){await N.advance(20);if(N.S.fsm.state==='DONE'){tDone=N.S.t;break;}}
  const S=N.S;
  return {state:S.fsm.state, t:S.t.toFixed(1), done:N.WPS.filter(w=>w.done&&!w.skipped).length+'/'+N.WPS.length,
    coll:S.coll, ped:S.collPed, still:S.collPedStill||0, gap:isFinite(S.minPed)?S.minPed.toFixed(2):'-', wall:(performance.now()-t0).toFixed(0)+'ms',
    log:S.log.filter(l=>/agent blocks|Replan|person|Skipping|Collision|stuck|Reached/.test(l.msg)).slice(0,14).map(l=>l.t.toFixed(1)+' '+l.msg).reverse()};
}'''
async def main():
    cases=json.loads(sys.argv[1]); verbose=len(sys.argv)>2
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        pg=await b.new_page(viewport={'width':1280,'height':900})
        errs=[]
        pg.on('console', lambda m: errs.append(m.text) if m.type in ('error',) else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto('file://'+os.path.abspath('wrapped.html')); await pg.wait_for_timeout(600)
        for lvl,ov,secs in cases:
            r=await pg.evaluate(TEST,{'lvl':lvl,'overrides':ov,'secs':secs})
            print('L%d'%(lvl+1),ov,{k:v for k,v in r.items() if k!='log'})
            if verbose:
                for l in r['log']: print('     ',l)
        print('ERRORS:',errs[:10])
        await b.close()
asyncio.run(main())
