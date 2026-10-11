import asyncio,os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        pg=await b.new_page(viewport={'width':1440,'height':900}); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://'+os.path.abspath('wrapped.html')); await pg.wait_for_timeout(500)
        n=await pg.evaluate("window.__an.LESSONS.length")
        for i in range(n):
            tries=await pg.evaluate(f"window.__an.LESSONS[{i}].tries.length")
            title=await pg.evaluate(f"window.__an.LESSONS[{i}].t")
            print(f'--- {i+1} {title}')
            for j in range(tries):
                r=await pg.evaluate(f"""async()=>{{const A=window.__an,N=window.__nav;const t0=performance.now();A.lessonGo(A.LESSONS[{i}].tries[{j}][1]);
                  for(let k=0;k<200&&A.AN.busy;k++)await new Promise(r=>setTimeout(r,50));
                  const R=A.AN.res,F=R.F||{{}};const ms=A.AN.meas.step;const sm=ms?A.stepMetrics(ms.data,ms.kind):null;
                  return {{lbl:A.LESSONS[{i}].tries[{j}][0],ctl:N.P.ctl,model:N.P.model,kind:R.M.kind,stable:R.stable,unstZ:R.unstableZ,Ncw:F.Ncw,PM:F.pm&&+F.pm.toFixed(1),GM:F.gm&&+F.gm.toFixed(1),wc:F.wc&&+F.wc.toFixed(2),DM:F.dm&&+F.dm.toFixed(3),Ms:F.ms&&+F.ms.toFixed(2),
                    zeta:R.zeta&&+R.zeta.toFixed(2),OS:R.smOff&&+R.smOff.overshoot.toFixed(1),essBias:R.smBias&&+R.smBias.final.toFixed(4),
                    meas:sm?JSON.stringify(Object.fromEntries(Object.entries(sm).map(([k,v])=>[k,v==null?null:+v.toFixed(3)]))):null,sat:ms&&ms.sat,nfreq:A.AN.meas.freq&&A.AN.meas.freq.length,msg:A.AN.msg.slice(0,60),ms:Math.round(performance.now()-t0)}}}}""")
                print('   ',r)
        print('ERR',errs[:5])
        await b.close()
asyncio.run(main())
