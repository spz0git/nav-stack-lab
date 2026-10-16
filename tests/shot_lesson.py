import asyncio, sys, os
from playwright.async_api import async_playwright
from _browser import launch, page_url
# Screenshots of one lesson (id like loc:0) at desktop and phone width → docs/screenshots/lessons/
lid=sys.argv[1] if len(sys.argv)>1 else 'loc:0'
async def main():
    async with async_playwright() as p:
        b=await launch(p)
        os.makedirs('../docs/screenshots/lessons',exist_ok=True)
        for name,w,h in [('desktop',1380,900),('phone',390,844)]:
            pg=await b.new_page(viewport={'width':w,'height':h},device_scale_factor=2)
            errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto(page_url('#lesson='+lid.split(':')[0]+':'+str(int(lid.split(':')[1])+1)))
            await pg.wait_for_timeout(900)
            await pg.evaluate("for(const e of [document.querySelector('#learnview'),document.querySelector('.right'),document.querySelector('.layout')])if(e)e.style.cssText+=';max-height:none;height:auto;overflow:visible'")
            await pg.wait_for_timeout(200)
            el=await pg.query_selector('#learnview')
            await el.screenshot(path=f'../docs/screenshots/lessons/{lid.replace(":","-")}-{name}.png')
            n=await pg.evaluate("document.querySelectorAll('#learnview .experiments li').length")
            print(name,'experiments',n,'errors',errs)
            await pg.close()
        await b.close()
asyncio.run(main())
