import asyncio,os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        pg=await b.new_page(viewport={'width':1440,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('C:'+m.text) if m.type=='error' and 'ERR_' not in m.text else None)
        await pg.goto('file://'+os.path.abspath('wrapped.html')); await pg.wait_for_timeout(600)
        # run, pause, scrub, reset → ghost
        await pg.evaluate("async()=>{const N=window.__nav;N.loadLevel(0);document.querySelector('#run').click();document.querySelector('#run').click();await N.advance(600)}")
        await pg.wait_for_timeout(300)
        print('scrub visible',await pg.evaluate("!document.querySelector('#scrub').hidden"),'frames',await pg.evaluate("document.querySelector('#scrubr').max"))
        await pg.evaluate("()=>{const r=document.querySelector('#scrubr');r.value=100;r.dispatchEvent(new Event('input'));}"); await pg.wait_for_timeout(200)
        print('replay label',await pg.evaluate("document.querySelector('#scrubt').textContent"))
        await pg.screenshot(path='p2_replay.png')
        await pg.click('#scrub-live'); await pg.click('#resetb'); await pg.wait_for_timeout(200)
        print('ghost',await pg.evaluate("window.__nav.GHOST?window.__nav.GHOST.label:null"))
        await pg.evaluate("async()=>{const N=window.__nav;N.setParam('ctl','rwf');document.querySelector('#run').click();document.querySelector('#run').click();await N.advance(400)}")
        await pg.click('#plotsel button[data-v="cte"]'); await pg.wait_for_timeout(300); await pg.screenshot(path='p2_ghost.png')
        # experiments
        await pg.click('#tg-tools'); await pg.click('#tab-exp'); await pg.wait_for_timeout(200)
        await pg.select_option('select[data-vary="0"]','ctl'); await pg.wait_for_timeout(200)
        await pg.fill('input[data-vals="0"]','pp, rwf'); await pg.fill('#exp-s1','2'); await pg.press('#exp-s1','Tab'); await pg.fill('#exp-secs','60'); await pg.press('#exp-secs','Tab'); await pg.wait_for_timeout(100)
        print('run label',await pg.evaluate("document.querySelector('#exp-run').textContent"))
        await pg.click('#exp-run')
        for i in range(60):
            await pg.wait_for_timeout(500)
            if not await pg.evaluate("window.__nav.EXP.running"):break
        print('results',await pg.evaluate("window.__nav.EXP.results.map(r=>[r.seed,r.cfg.ctl,r.s&&r.s.cteRMS,r.s&&r.s.goalsDone,r.error])"))
        await pg.wait_for_timeout(300); await pg.screenshot(path='p2_exp.png')
        print('rows',await pg.evaluate("document.querySelectorAll('.exptab tbody tr').length"),'csv lines',await pg.evaluate("window.__nav.expCSV().split('\\n').length"))
        # config link roundtrip
        await pg.evaluate("window.__nav.setParam('ppL0',1.2)")
        url=await pg.evaluate("window.__nav.configURL()"); print('url hash',url.split('#')[1][:80])
        pg2=await b.new_page(viewport={'width':1280,'height':800}); await pg2.goto(url); await pg2.wait_for_timeout(700)
        print('restored',await pg2.evaluate("[window.__nav.LEVELS.indexOf(window.__nav.LV||null), window.__nav.P.ctl, window.__nav.P.ppL0, window.__nav.S.log.find(l=>/restored/.test(l.msg))?.msg]"))
        print('ERR',errs); await b.close()
asyncio.run(main())
