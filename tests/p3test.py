import asyncio,os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        pg=await b.new_page(viewport={'width':1440,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('C:'+m.text) if m.type=='error' and 'ERR_' not in m.text else None)
        await pg.goto('file://'+os.path.abspath('../dist/nav-stack-lab.html')); await pg.wait_for_timeout(600)
        N="window.__nav"
        # planner slot on L2 (warehouse)
        await pg.evaluate(f"{N}.loadLevel(1)"); await pg.click('#tg-tools'); await pg.click('#tab-code'); await pg.wait_for_timeout(150)
        await pg.click('#codeslot button[data-v="plan"]'); await pg.wait_for_timeout(150); await pg.click('#loadcode'); await pg.wait_for_timeout(300)
        print('plan param',await pg.evaluate(f"{N}.P.plan"),await pg.evaluate("document.querySelector('#codestat').textContent"))
        r=await pg.evaluate(f"async()=>{{const N={N};document.querySelector('#run').click();document.querySelector('#run').click();await N.advance(2400);return [N.S.fsm.state,N.WPS.filter(w=>w.done&&!w.skipped).length,N.S.coll,N.S.log.filter(l=>/Plan|Replan/.test(l.msg)).slice(-1)[0]?.msg]}}")
        print('custom planner L2:',r)
        # localizer slot on L3
        await pg.evaluate(f"{N}.loadLevel(2)"); await pg.click('#tg-tools'); await pg.click('#tab-code'); await pg.wait_for_timeout(150)
        await pg.click('#codeslot button[data-v="loc"]'); await pg.wait_for_timeout(150); await pg.click('#loadcode'); await pg.wait_for_timeout(300)
        r=await pg.evaluate(f"async()=>{{const N={N};document.querySelector('#run').click();document.querySelector('#run').click();await N.advance(2000);const S=N.S;return [N.P.loc,S.fsm.state,N.WPS.filter(w=>w.done).length,Math.sqrt(S.errSq/S.errN).toFixed(3),Math.hypot(S.robot.x-S.est.x,S.robot.y-S.est.y).toFixed(2)]}}")
        print('custom localizer L3 (loc, state, goals, poseRMS, final err):',r)
        # predictor slot on L5
        await pg.evaluate(f"{N}.loadLevel(4)"); await pg.click('#tg-tools'); await pg.click('#tab-code'); await pg.wait_for_timeout(150)
        await pg.click('#codeslot button[data-v="pred"]'); await pg.wait_for_timeout(150); await pg.click('#loadcode'); await pg.wait_for_timeout(300)
        r=await pg.evaluate(f"async()=>{{const N={N};document.querySelector('#run').click();document.querySelector('#run').click();await N.advance(2600);const S=N.S;return [N.P.agPred,S.fsm.state,N.WPS.filter(w=>w.done).length,S.collPed,S.agents.tracks.filter(t=>t.traj).length]}}")
        print('custom predictor L5 (agPred, state, goals, contacts, tracks with traj):',r)
        # source viewer
        await pg.click('#tg-pipe'); await pg.click('#tab-ctl'); await pg.click('details[data-how="ctl"] summary'); await pg.click('[data-source]'); await pg.wait_for_timeout(200)
        print('source dialog',await pg.evaluate("[document.querySelector('#srcdlg').open, document.querySelector('#src-file').value, document.querySelector('#src-pre').textContent.length, document.querySelectorAll('#src-file option').length]"))
        await pg.screenshot(path='p3_src.png'); await pg.click('#src-close')
        print('ERR',errs); await b.close()
asyncio.run(main())
