import asyncio,os
from playwright.async_api import async_playwright
from _browser import launch, page_url
async def main():
    async with async_playwright() as p:
        b=await launch(p)
        pg=await b.new_page(viewport={'width':1440,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('C:'+m.text) if m.type=='error' and 'ERR_' not in m.text else None)
        await pg.goto(page_url()); await pg.wait_for_timeout(600)
        menu_bad=[]
        # the level menu at 1440 × 900 and 1280 × 720: every level's last quick experiment can be scrolled into view
        for vw,vh in [(1440,900),(1280,720)]:
            await pg.set_viewport_size({'width':vw,'height':vh})
            for lvl in range(await pg.evaluate("window.__nav.LEVELS.length")):
                await pg.evaluate(f"window.__nav.loadLevel({lvl})"); await pg.click('#lvl-btn'); await pg.wait_for_timeout(150)
                r=await pg.evaluate('''()=>{const m=document.querySelector('#lvlmenu'),q=m.querySelector('.brief');q.scrollTop=1e6;
                  const li=[...q.querySelectorAll('li')].pop();return li?[Math.round(li.getBoundingClientRect().bottom),Math.round(Math.min(m.getBoundingClientRect().bottom,innerHeight))]:null}''')
                if r and r[0]>r[1]+1: menu_bad.append((f'level menu {vw}x{vh} L{lvl+1}: last quick experiment below the menu',r))
                await pg.keyboard.press('Escape'); await pg.wait_for_timeout(50)
        await pg.set_viewport_size({'width':1440,'height':900})
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
        print('level menu, last quick experiment reachable on every level:',not menu_bad); bad+=menu_bad
        print('ERRORS',bad); await b.close()
asyncio.run(main())
