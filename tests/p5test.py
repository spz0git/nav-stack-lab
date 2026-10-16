import asyncio,os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        pg=await b.new_page(viewport={'width':1440,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('C:'+m.text) if m.type=='error' and 'ERR_' not in m.text else None)
        await pg.goto('file://'+os.path.abspath('../dist/nav-stack-lab.html')); await pg.wait_for_timeout(600)
        await pg.click('#tab-learn'); await pg.wait_for_timeout(200)
        # every sim lesson try button exists and runs without error (short)
        n=await pg.evaluate("document.querySelectorAll('button[data-try]').length"); print('try buttons',n)
        ids=await pg.evaluate("[...document.querySelectorAll('button[data-try]')].map(b=>b.dataset.try).filter(x=>!x.startsWith('ctl:'))")
        bad=[]
        for t in ids:
            g,i,j=t.split(':')
            await pg.evaluate(f"(()=>{{const G=window.__an.LESSON_GROUPS().find(x=>x.id==='{g}');const cfg=G.items[{i}].tries[{j}][1];return window.__nav.tryGo(cfg)}})()")
            await pg.wait_for_timeout(250)
            await pg.evaluate("async()=>{await window.__nav.advance(40)}")
            st=await pg.evaluate("[window.__nav.LV.id, window.__nav.S.fsm.state]")
            if errs: bad.append((t,errs[:])); errs.clear()
            await pg.keyboard.press('Space'); await pg.click('#tab-learn'); await pg.wait_for_timeout(50)
        print('lesson tries run:',len(ids),'errors:',bad)
        # level tries
        for lvl in range(await pg.evaluate("window.__nav.LEVELS.length")):
            await pg.evaluate(f"window.__nav.loadLevel({lvl})"); await pg.wait_for_timeout(100)
            nb=await pg.evaluate("window.__nav.LV.tries.reduce((a,t)=>a+t.b.length,0)")
            for i in range(await pg.evaluate("window.__nav.LV.tries.length")):
                for j in range(await pg.evaluate(f"window.__nav.LV.tries[{i}].b.length")):
                    await pg.evaluate(f"window.__nav.tryGo(window.__nav.LV.tries[{i}].b[{j}][1])"); await pg.wait_for_timeout(150)
                    await pg.evaluate("async()=>{await window.__nav.advance(40)}")
                    if errs: bad.append((lvl,i,j,errs[:])); errs.clear()
                    await pg.keyboard.press('Space')
            print('L%d tries'%(lvl+1),nb)
        print('ERRORS',bad); await b.close()
asyncio.run(main())
