import asyncio,os
from playwright.async_api import async_playwright
from _browser import launch, page_url
async def main():
    async with async_playwright() as p:
        b=await launch(p)
        pg=await b.new_page(viewport={'width':1440,'height':900}); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(page_url()); await pg.wait_for_timeout(500)
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
        # glossary: every lesson lists its terms, every id exists, and marking leaves the text unchanged
        g=await pg.evaluate("""()=>{const A=window.__an,tx=h=>{const d=document.createElement('div');d.innerHTML=h;return d.textContent;},bad=[];let n=0,m=0;
          for(const G of A.LESSON_GROUPS())for(const L of G.items){const raw=(A.LESSON_TERMS[L.t]||'').split(' ').filter(Boolean);
            if(!raw.length)bad.push('no terms: '+L.t);raw.filter(id=>!A.GLOSS[id]).forEach(id=>bad.push('unknown '+id+': '+L.t));
            const h=A.glossMark(L.b,A.lessonTerms(L));if(tx(h)!==tx(L.b))bad.push('text changed: '+L.t);n+=raw.length;m+=(h.match(/class="term"/g)||[]).length;}
          return {lessons:A.LESSON_GROUPS().reduce((a,G)=>a+G.items.length,0),listed:n,marked:m,bad};}""")
        print('GLOSSARY',g); errs+=['GLOSSARY '+x for x in g['bad']]
        # the self-check: exact is right, within 5 % is close enough with the exact value shown, beyond is not; a count
        # (Tolerance 0) stays exact
        async def check(h,v):
            await pg.evaluate(f"location.hash='{h}'"); await pg.wait_for_timeout(300)
            g,k=h[7:].split(':'); d=pg.locator(f'#learnview .selfcheck[data-ck="{g}:{int(k)-1}"]'); await d.locator('input').fill(v); await d.locator('.sc-go').click()
            r=d.locator('.sc-res'); return (await r.get_attribute('class')).split()[-1], (await r.inner_text())[:40]
        sc={v:await check('lesson=saf:2',v) for v in ['27.6','28','26.5','30']}
        sc['count 595']=await check('lesson=loc:8','595')
        print('SELFCHECK',sc)
        want={'27.6':('ok','Right.'),'28':('ok','Close enough'),'26.5':('ok','Close enough'),'30':('no',''),'count 595':('no','')}
        errs+=[f'SELFCHECK {v}: {sc[v]}' for v,(k,t) in want.items() if sc[v][0]!=k or not sc[v][1].startswith(t)]
        print('ERR',errs[:5])
        await b.close()
asyncio.run(main())
