import asyncio, sys
from playwright.async_api import async_playwright
html=open('../dist/nav-stack-lab.html').read()
page_html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>'
open('wrapped.html','w').write(page_html)
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
    log:S.log.slice(0,8).map(l=>l.t.toFixed(1)+' '+l.msg).reverse()};
}'''
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        pg=await b.new_page(viewport={'width':1280,'height':900})
        errs=[]
        pg.on('console', lambda m: errs.append(m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto('file://'+__import__('os').path.abspath('wrapped.html'))
        await pg.wait_for_timeout(800)
        cases=[(0,{},90),(0,{'ctl':'pid'},90),(0,{'ctl':'dwa'},90),(1,{},120),(1,{'plan':'rrtstar'},120),(1,{'plan':'straight'},60),(1,{'mis':'optimal'},120),
               (2,{},150),(2,{'loc':'ekf'},150),(2,{'loc':'pf'},150),(3,{},200),(3,{'unknownAs':'lethal'},200),(4,{},200),(4,{'ctl':'dwa'},200)]
        for lvl,ov,secs in cases:
            r=await pg.evaluate(TEST,{'lvl':lvl,'overrides':ov,'secs':secs})
            print(lvl+1,ov,{k:v for k,v in r.items() if k!='log'})
            for l in r['log']: print('     ',l)
        print('ERRORS:',errs[:10])
        await b.close()
asyncio.run(main())
