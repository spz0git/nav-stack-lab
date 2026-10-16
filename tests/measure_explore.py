import asyncio, json, sys
from playwright.async_api import async_playwright
from _browser import launch, page_url
# Measures frontier exploration (Mission → Goal order → Explore) headless: time to "Exploration complete", floor seen,
# distance, frontier goals visited, given up or seen on the way, collisions. A case: {name, lvl, set, secs, seeds:[…]};
# the run stops at DONE or after secs. Baseline cases (any goal order) report the same fields for comparison.
#   python3 measure_explore.py '[{"name":"L4","lvl":3,"set":{"mis":"explore"},"secs":300,"seeds":[7,1,2,3]}]'
RUN=r'''
async ({lvl, overrides, secs, seed}) => {
  const N=window.__nav; if(seed!=null)N.setParam('seed',seed,false);
  N.loadLevel(lvl); for(const [k,v] of Object.entries(overrides)) N.setParam(k,v,false);
  document.querySelector('#run').click(); document.querySelector('#run').click();
  const S=N.S; let n=0;
  while(n<secs&&S.fsm.state!=='DONE'){await N.advance(20);n+=1;}
  const c=re=>S.log.filter(l=>re.test(l.msg)).length;
  const ex=S.log.filter(l=>/^Explor|Frontier|Skipping|complete/.test(l.msg)).map(l=>l.t.toFixed(1)+' '+l.msg).reverse();
  return{t:+S.t.toFixed(1),state:S.fsm.state,seen:+(100*(N.exploredFrac()||0)).toFixed(0),dist:+S.dist.toFixed(1),coll:S.coll,
    goals:c(/^Explore/),reached:c(/^Reached goal/),onway:c(/^Frontier at .* seen on the way/),skipped:c(/^Skipping/),
    replans:c(/^Replan/),noPath:c(/no path/),log:ex};
}'''
async def main():
    cases=json.loads(sys.argv[1]); full='--log' in sys.argv
    async with async_playwright() as p:
        b=await launch(p); pg=await b.new_page(viewport={'width':1280,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto(page_url()); await pg.wait_for_timeout(800)
        for c in cases:
            for sd in c.get('seeds') or [None]:
                r=await pg.evaluate(RUN,{'lvl':c.get('lvl',3),'overrides':c.get('set',{}),'secs':c.get('secs',300),'seed':sd})
                print('==',c.get('name',''),'seed',sd,c.get('set',{}),{k:r[k] for k in r if k!='log'})
                if full:
                    for l in r['log']: print('      ',l)
        print('ERRORS:',errs[:5]); await b.close()
asyncio.run(main())
