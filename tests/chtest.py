# Companion notes: the chapter opens from the Learn column, its live values fill, every Try button runs, deep link works.
import asyncio,os,sys
from playwright.async_api import async_playwright
OUT=sys.argv[1] if len(sys.argv)>1 else None
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        pg=await b.new_page(viewport={'width':1440,'height':900}); errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text else None)
        await pg.goto('file://'+os.path.abspath('wrapped.html')); await pg.wait_for_timeout(600)
        await pg.click('#tab-learn'); await pg.wait_for_timeout(200)
        n=await pg.evaluate("document.querySelectorAll('.chapter-open').length"); print('chapters listed',n)
        await pg.click('.chapter-open'); await pg.wait_for_timeout(400)
        live=await pg.evaluate("[...document.querySelectorAll('#learnview .live')].map(e=>e.dataset.k+'='+e.textContent)")
        print('live',len(live),[x for x in live if x.endswith('=—') or x.endswith('=…') or x.endswith('=?')])
        print('math',await pg.evaluate("document.querySelectorAll('#learnview math').length"),'tries',await pg.evaluate("document.querySelectorAll('#learnview button.try').length"))
        if OUT: await pg.screenshot(path=f'{OUT}/ch6_top.png')
        tries=await pg.evaluate("[...document.querySelectorAll('#learnview button.try')].map(b=>b.textContent)")
        for i,t in enumerate(tries):
            await pg.evaluate(f"document.querySelectorAll('#learnview button.try')[{i}].click()"); await pg.wait_for_timeout(250)
            if 'Measure' in t or 'sine' in t or 'EKF' in t:
                await pg.wait_for_function("!window.__an.AN.busy",timeout=60000)
            v=await pg.evaluate("[...document.querySelectorAll('#learnview .live')].slice(0,6).map(e=>e.textContent).join(' ')")
            print(f'  try {i:2d} {t[:34]:34s} → {v}')
        if OUT: await pg.screenshot(path=f'{OUT}/ch6_after.png')
        # deep link
        pg2=await b.new_page(viewport={'width':390,'height':844},device_scale_factor=2)
        await pg2.goto('file://'+os.path.abspath('wrapped.html')+'#notes=ch6'); await pg2.wait_for_timeout(700)
        print('deep link open:',await pg2.evaluate("!!document.querySelector('#learnview article.chapter')"),'scrollW',await pg2.evaluate("document.documentElement.scrollWidth"))
        if OUT: await pg2.screenshot(path=f'{OUT}/ch6_mobile.png')
        print('ERRORS',errs[:5])
        await b.close()
asyncio.run(main())
