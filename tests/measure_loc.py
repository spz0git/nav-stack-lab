import asyncio, json, sys
from playwright.async_api import async_playwright
from _browser import launch, page_url
# Measures what the localization lessons' Try buttons show, headless: pose error, filter σ, NEES, rejected readings,
# particle-filter N_eff and injections over time. A case: {name, lvl, set, secs, every, act, dense}.
# act 'kidnap' or 'scatter' happens after 8 s (as tryGo does); dense = seconds sampled every second after the act.
RUN=r'''
async ({lvl, overrides, secs, every, act, dense}) => {
  const N=window.__nav; N.loadLevel(lvl);
  for(const [k,v] of Object.entries(overrides)) N.setParam(k,v,false);
  document.querySelector('#run').click(); document.querySelector('#run').click();
  const S=N.S, rows=[]; let inside=0,n=0,t0=0;
  const samp=()=>{const r=S.robot,e=S.est,err=Math.hypot(r.x-e.x,r.y-e.y);
    const s=S.Pc?Math.sqrt(Math.max(0,S.Pc[0]+S.Pc[4])):null;
    const nees=S.nees.length?S.nees.reduce((a,b)=>a+b,0)/S.nees.length:null;
    const dth=Math.abs(((r.th-e.th+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI)*180/Math.PI;
    const row={t:+S.t.toFixed(1),err:+err.toFixed(2),dth:+dth.toFixed(0),sig:s==null?null:+s.toFixed(2),nees:nees==null?null:+nees.toFixed(1),rej:S.rejected||0,st:S.fsm.state,done:N.WPS.filter(w=>w.done&&!w.skipped).length,skip:N.WPS.filter(w=>w.skipped).length,coll:S.coll};
    if(S.pf){row.neff=Math.round(S.pf.neff);row.inj=S.pf.inj;row.wf=+S.pf.wfast.toFixed(3);row.ws=+S.pf.wslow.toFixed(3);}
    if(S.slam&&S.slam.lm)row.lms=S.slam.lm.length;
    rows.push(row);};
  const step=async(secsRun,evry)=>{const total=Math.round(secsRun/evry),per=Math.round(evry/0.05);
    for(let i=0;i<total;i++){for(let j=0;j<per;j++){await N.advance(1);const r=S.robot,e=S.est,err=Math.hypot(r.x-e.x,r.y-e.y);
      if(S.Pc){const s=Math.sqrt(Math.max(0,S.Pc[0]+S.Pc[4]));n++;if(err<2*s)inside++;}}samp();}};
  if(act){await N.advance(160);samp();if(act==='kidnap')N.kidnapTo(null);else N.scatter();samp();await step(dense||20,1);await step(secs-8-(dense||20),every);}
  else await step(secs,every);
  return {rows, inside2s:n?+(inside/n).toFixed(2):null, poseRMS:S.errN?+Math.sqrt(S.errSq/S.errN).toFixed(2):null,
    log:S.log.filter(l=>/kidnap|Scatter|inject|Replan|skip|lost/i.test(l.msg)).slice(0,12).map(l=>l.t.toFixed(1)+' '+l.msg).reverse()};
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
            r=await pg.evaluate(RUN,{'lvl':c['lvl'],'overrides':c.get('set',{}),'secs':c.get('secs',150),'every':c.get('every',10),'act':c.get('act'),'dense':c.get('dense')})
            print('==',c.get('name',''),'L%d'%(c['lvl']+1),c.get('set',{}),c.get('act',''),'inside2σ',r['inside2s'],'poseRMS',r['poseRMS'])
            for row in r['rows']: print('   ',row)
            for l in r['log']: print('      ',l)
        print('ERRORS:',errs[:5])
        await b.close()
asyncio.run(main())
