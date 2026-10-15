import asyncio, json, sys
from playwright.async_api import async_playwright
from _browser import launch, page_url
# Measures what the planning lessons' Try buttons show, headless: every Plan/Replan log line (planner, length,
# expansions or samples, time, cusps, waits), replan reasons, mission progress, collisions and contacts.
# A case: {name, lvl, set, secs, seeds:[…]} — with seeds, the level is reloaded per seed and only the first plan is reported.
RUN=r'''
async ({lvl, overrides, secs, seed, cfg}) => {
  const N=window.__nav; if(seed!=null)N.setParam('seed',seed,false);
  if(cfg){await N.tryGo(cfg);document.querySelector('#run').click();}   // exactly what the lesson button does, then pause
  else{N.loadLevel(lvl);for(const [k,v] of Object.entries(overrides)) N.setParam(k,v,false);
    document.querySelector('#run').click(); document.querySelector('#run').click();}
  const S=N.S;
  if(secs>0)await N.advance(Math.round(secs/0.05));
  const plans=S.log.filter(l=>/^(Plan|Replan)/.test(l.msg)).map(l=>l.t.toFixed(1)+' '+l.msg).reverse();
  const reasons={};for(const l of S.log){const m=/^Replan \(([^)]+)\)/.exec(l.msg);if(m)reasons[m[1]]=(reasons[m[1]]||0)+1;}
  const other=S.log.filter(l=>/no path|Skipping|Cusp|Contact|yield|Reached|complete/i.test(l.msg)).map(l=>l.t.toFixed(1)+' '+l.msg).reverse();
  return{t:+S.t.toFixed(1),state:S.fsm.state,done:N.WPS.filter(w=>w.done&&!w.skipped).length,skip:N.WPS.filter(w=>w.skipped).length,coll:S.coll,ped:S.collPed,
    minPed:isFinite(S.minPed)?+S.minPed.toFixed(2):null,dist:+S.dist.toFixed(1),plans,reasons,other,stats:S.planStats};
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
            seeds=c.get('seeds') or [None]
            for sd in seeds:
                r=await pg.evaluate(RUN,{'lvl':c.get('lvl'),'overrides':c.get('set',{}),'secs':c.get('secs',0),'seed':sd,'cfg':c.get('cfg')})
                if len(seeds)>1:
                    print('==',c.get('name',''),'seed',sd,[l for l in r['plans'] if 'RRT' in l][:1])
                else:
                    print('==',c.get('name',''),c.get('cfg') or ('L%d'%(c['lvl']+1),c.get('set',{})),{k:r[k] for k in ['t','state','done','skip','coll','ped','minPed','dist']},'replans',r['reasons'])
                    for l in r['plans']: print('   ',l)
                    for l in r['other'][:14]: print('      ',l)
        print('ERRORS:',errs[:5])
        await b.close()
asyncio.run(main())
