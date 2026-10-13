# Companion notes: every chapter opens from the Learn column, its live values fill, every Try button runs; section deep links
# and the lessons' derivation links (a.chref) open the right chapter at the right heading and come back to the lesson.
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
        ids=await pg.evaluate("[...document.querySelectorAll('.chapter-open')].map(b=>b.dataset.ch)"); print('chapters listed',ids)
        for ch in ids:
            await pg.evaluate(f"window.__an.setUIMode('learn');window.__an.openChapter('{ch}')"); await pg.wait_for_timeout(400)
            live=await pg.evaluate("[...document.querySelectorAll('#learnview .live')].map(e=>e.dataset.k+'='+e.textContent)")
            bad=[x for x in live if x.endswith('=—') or x.endswith('=…') or x.endswith('=?')]
            print(ch,'live',len(live),'unfilled',bad,'math',await pg.evaluate("document.querySelectorAll('#learnview math').length"),'tries',await pg.evaluate("document.querySelectorAll('#learnview button.try').length"))
            if OUT: await pg.screenshot(path=f'{OUT}/{ch}_top.png')
            tries=await pg.evaluate("[...document.querySelectorAll('#learnview button.try')].map(b=>b.textContent)")
            for i,t in enumerate(tries):
                await pg.evaluate(f"document.querySelectorAll('#learnview button.try')[{i}].click()"); await pg.wait_for_timeout(250)
                if 'Measure' in t or 'sine' in t or ('EKF' in t and ch=='ch6'):
                    await pg.wait_for_function("!window.__an.AN.busy",timeout=60000)
                if await pg.evaluate("window.__nav.S.fsm.state")=='DRIVE': await pg.evaluate("window.__nav.advance(40)")
                v=await pg.evaluate("[...document.querySelectorAll('#learnview .live')].slice(0,6).map(e=>e.textContent).join(' ')")
                print(f'  try {i:2d} {t[:34]:34s} → {v}')
            await pg.evaluate("window.__an.chapterBack()"); await pg.wait_for_timeout(150)
        # derivation links from lessons: each opens its chapter at the section, Back returns to the lesson
        links=await pg.evaluate("[...document.querySelectorAll('#learnview a.chref')].map(a=>[a.closest('details.lesson').dataset.l,a.getAttribute('href')])")
        print('derivation links',len(links))
        for lid,href in links:
            await pg.evaluate(f"window.__an.openLesson('{lid}')"); await pg.wait_for_timeout(100)
            await pg.evaluate(f"document.querySelector('#learnview a.chref[href=\"{href}\"]').click()"); await pg.wait_for_timeout(300)
            sec=href.split('/')[1] if '/' in href else None
            ok=await pg.evaluate(f"!!document.querySelector('#learnview article.chapter')&&(!{'true' if sec else 'false'}||!!document.querySelector('#n-{sec or 'x'}'))")
            await pg.evaluate("document.querySelector('#learn-back').click()"); await pg.wait_for_timeout(150)
            back=await pg.evaluate(f"window.__an.lessonOpen==='{lid}'")
            print(f'  {lid:7s} {href:60s} opens {ok} back {back}')
            if not(ok and back): errs.append('LINK '+href)
        # deep links on a phone
        pg2=await b.new_page(viewport={'width':390,'height':844},device_scale_factor=2)
        for h in ['#notes=ch6','#notes=ch2/4-the-kalman-update-derived']:
            await pg2.goto('file://'+os.path.abspath('wrapped.html')+h); await pg2.wait_for_timeout(700)
            print('deep link',h,'open:',await pg2.evaluate("!!document.querySelector('#learnview article.chapter')"),'scrollW',await pg2.evaluate("document.documentElement.scrollWidth"))
        if OUT: await pg2.screenshot(path=f'{OUT}/ch_mobile.png')
        print('ERRORS',errs[:5])
        await b.close()
asyncio.run(main())
