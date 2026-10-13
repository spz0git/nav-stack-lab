import asyncio, json, sys
from playwright.async_api import async_playwright
# Measures what the localization lessons' Try buttons show: pose error, filter σ and NEES over time, headless.
RUN=r'''
async ({lvl, overrides, secs, every}) => {
  const N=window.__nav; N.loadLevel(lvl);
  for(const [k,v] of Object.entries(overrides)) N.setParam(k,v,false);
  document.querySelector('#run').click(); document.querySelector('#run').click();
  const S=N.S, rows=[]; let inside=0,n=0;
  const stepsPer=Math.round(every/0.05), total=Math.round(secs/every);
  for(let i=1;i<=total;i++){
    for(let j=0;j<stepsPer;j++){ await N.advance(1);
      const r=S.robot,e=S.est,err=Math.hypot(r.x-e.x,r.y-e.y);
      if(S.Pc){const s=Math.sqrt(Math.max(0,S.Pc[0]+S.Pc[4]));n++;if(err<2*s)inside++;}}
    const r=S.robot,e=S.est,err=Math.hypot(r.x-e.x,r.y-e.y);
    const s=S.Pc?Math.sqrt(Math.max(0,S.Pc[0]+S.Pc[4])):null;
    const nees=S.nees.length?S.nees.reduce((a,b)=>a+b,0)/S.nees.length:null;
    rows.push({t:S.t.toFixed(0),err:+err.toFixed(2),sig:s==null?null:+s.toFixed(2),nees:nees==null?null:+nees.toFixed(1),dth:+(Math.abs(((r.th-e.th+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI)*180/Math.PI).toFixed(1),state:S.fsm.state,done:N.WPS.filter(w=>w.done&&!w.skipped).length,skipped:N.WPS.filter(w=>w.skipped).length,coll:S.coll});
  }
  return {rows, inside2s:n?+(inside/n).toFixed(2):null, poseRMS:S.errN?+Math.sqrt(S.errSq/S.errN).toFixed(2):null};
}'''
async def main():
    cases=json.loads(sys.argv[1])
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        pg=await b.new_page(viewport={'width':1280,'height':900})
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto('file://'+__import__('os').path.abspath('wrapped.html'))
        await pg.wait_for_timeout(800)
        for c in cases:
            r=await pg.evaluate(RUN,{'lvl':c['lvl'],'overrides':c.get('set',{}),'secs':c.get('secs',150),'every':c.get('every',10)})
            print('==',c.get('name',''),c['lvl']+1,c.get('set',{}),'inside2σ',r['inside2s'],'poseRMS',r['poseRMS'])
            for row in r['rows']: print('   ',row)
        print('ERRORS:',errs[:5])
        await b.close()
asyncio.run(main())
