# Glossary coverage: every lesson and How-it-works note gets term definitions; lists formula symbols still undefined.
import asyncio, os, sys, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        pg=await b.new_page(viewport={'width':1280,'height':900});errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file://'+os.path.abspath('wrapped.html'));await pg.wait_for_timeout(600)
        cov=await pg.evaluate('window.__gloss.glCoverage()')
        bad=0
        for c in cov:
            miss=', '.join(f'{t}×{n}' if n>1 else t for t,n in c['miss'])
            if c['terms']==0 or c['miss']:bad+=1
            print(f"{c['terms']:3d} terms  {c['id'][:60]:60s} {('UNDEFINED: '+miss) if miss else ''}")
        print('BODIES',len(cov),'WITH GAPS',bad)
        print('ERRORS',errs)
        await b.close()
asyncio.run(main())
