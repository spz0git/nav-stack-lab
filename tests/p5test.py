import asyncio,os
from playwright.async_api import async_playwright
from _browser import launch, page_url
FSM={'IDLE','PLAN','DRIVE','NO_PATH','LOST','DONE'}   # the mission's states (core/mission.js)
async def main():
    async with async_playwright() as p:
        b=await launch(p)
        pg=await b.new_page(viewport={'width':1440,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('C:'+m.text) if m.type=='error' and 'ERR_' not in m.text else None)
        await pg.goto(page_url()); await pg.wait_for_timeout(600)
        await pg.click('#tab-learn'); await pg.wait_for_timeout(200)
        # every sim lesson try button exists and runs without error (short), on the level it names, in a known state
        n=await pg.evaluate("document.querySelectorAll('button[data-try]').length"); print('try buttons',n)
        ids=await pg.evaluate("[...document.querySelectorAll('button[data-try]')].map(b=>b.dataset.try).filter(x=>!x.startsWith('ctl:'))")
        bad=[]
        for t in ids:
            g,i,j=t.split(':')
            lv=await pg.evaluate(f"(()=>{{const G=window.__an.LESSON_GROUPS().find(x=>x.id==='{g}');const cfg=G.items[{i}].tries[{j}][1];return window.__nav.tryGo(cfg).then(()=>cfg.level??null)}})()")
            await pg.wait_for_timeout(250)
            await pg.evaluate("async()=>{await window.__nav.advance(40)}")
            # the level as a cfg names it: a built-in's index or a generator spec (levelOf keeps the spec as genSpec)
            st=await pg.evaluate("(()=>{const N=window.__nav,L=N.LV;return [N.LEVELS.includes(L)?N.LEVELS.indexOf(L):L.genSpec||L.id, N.S.fsm.state]})()")
            if lv is not None and st[0]!=lv: errs.append(f'LEVEL {st[0]} not {lv}')
            if st[1] not in FSM: errs.append(f'FSM {st[1]}')
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
                    if (f:=await pg.evaluate("window.__nav.S.fsm.state")) not in FSM: errs.append(f'FSM {f}')
                    if errs: bad.append((lvl,i,j,errs[:])); errs.clear()
                    await pg.keyboard.press('Space')
            print('L%d tries'%(lvl+1),nb)
        print('ERRORS',bad); await b.close()
asyncio.run(main())
