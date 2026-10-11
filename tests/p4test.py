import asyncio,os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        pg=await b.new_page(viewport={'width':1440,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('C:'+m.text) if m.type=='error' and 'ERR_' not in m.text else None)
        await pg.goto('file://'+os.path.abspath('wrapped.html')); await pg.wait_for_timeout(600)
        await pg.click('#tab-learn'); await pg.wait_for_timeout(200)
        n=await pg.evaluate("document.querySelectorAll('details.lesson').length"); print('lessons',n)
        # click a sim lesson try: Localization lesson 3, try 1 (EKF unlabeled kidnap)
        await pg.click('details[data-l="loc:2"] summary'); await pg.wait_for_timeout(100)
        await pg.click('button[data-try="loc:2:1"]'); await pg.wait_for_timeout(2500)
        print('after lesson try:',await pg.evaluate("[window.__nav.LV.id, window.__nav.P.loc, window.__nav.P.assoc, window.__nav.S.log.filter(l=>/kidnap/.test(l.msg)).length, document.querySelector('#plotsel button[aria-pressed=true]').textContent]"))
        await pg.keyboard.press('Space')
        await pg.click('#tab-learn'); await pg.wait_for_timeout(100); await pg.click('details[data-l="plan:2"] summary'); await pg.click('button[data-try="plan:2:0"]'); await pg.wait_for_timeout(600)
        print('hybrid lesson:',await pg.evaluate("[window.__nav.LV.id, window.__nav.P.plan]")); await pg.keyboard.press('Space')
        await pg.click('#tab-learn'); await pg.wait_for_timeout(100); await pg.screenshot(path='p4_learn.png')
        # FSM
        await pg.click('#tab-mis'); await pg.wait_for_timeout(200); print('fsm svg',await pg.evaluate("[!!document.querySelector('.fsm'), document.querySelector('.fsm-box.on')?.nextElementSibling?.textContent]"))
        await pg.locator('.console').screenshot(path='p4_fsm.png')
        # symbols search
        await pg.click('#tab-sym'); await pg.fill('#symq','margin'); await pg.wait_for_timeout(200)
        print('sym visible rows',await pg.evaluate("document.querySelectorAll('#pane dt:not(.hidden)').length"),'groups',await pg.evaluate("document.querySelectorAll('#pane .nom:not(.hidden)').length"))
        await pg.locator('.console').screenshot(path='p4_sym.png')
        print('ERR',errs); await b.close()
asyncio.run(main())
