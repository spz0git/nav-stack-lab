# Screenshots for UI reviews: first screen, L5 running and the Learn tab at 1440×900 and 390×844, plus dark-mode shots.
# Also phone-full.png: the whole phone page at 1× (the order of everything below the first screen).
# Usage (from tests/, after ./build.sh): python3 shots.py <out-dir> [dark-shot ...]
#   dark shots are named like the light ones, e.g. phone-l5 or desk-learn (default: phone-l5).
# Also prints layout checks: horizontal overflow, and where the map sits on the phone.
import asyncio, os, sys
from playwright.async_api import async_playwright
SIZES={'desk':(1440,900),'phone':(390,844)}
async def shot(b,out,size,name,dark=False):
    w,h=SIZES[size]
    ctx=await b.new_context(viewport={'width':w,'height':h},device_scale_factor=2 if size=='phone' else 1,color_scheme='dark' if dark else 'light',is_mobile=size=='phone',has_touch=size=='phone')
    pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file://'+os.path.abspath('wrapped.html')); await pg.wait_for_timeout(700)
    if name=='full':
        await ctx.close(); ctx=await b.new_context(viewport={'width':w,'height':h},color_scheme='dark' if dark else 'light',is_mobile=True,has_touch=True)
        pg=await ctx.new_page(); await pg.goto('file://'+os.path.abspath('wrapped.html')); await pg.wait_for_timeout(700)
    if name=='l5':
        await pg.evaluate("window.__nav.loadLevel(4)")
        await pg.click('#run'); await pg.evaluate("async()=>{await window.__nav.advance(500)}")
        await pg.wait_for_timeout(300)
    elif name=='learn':
        await pg.click('#tab-learn'); await pg.wait_for_timeout(150)
        await pg.evaluate("(()=>{const d=document.querySelector('details.lesson');if(d)d.open=true;})()")
        await pg.wait_for_timeout(150)
        await pg.evaluate("document.querySelector('#tab-learn').scrollIntoView({block:'start'})")
        await pg.wait_for_timeout(150)
    fn=f"{size}-{name}{'-dark' if dark else ''}.png"
    await pg.screenshot(path=os.path.join(out,fn),full_page=name=='full')
    info=await pg.evaluate("""()=>{const d=document.documentElement,m=document.querySelector('#map').getBoundingClientRect(),h=document.querySelector('h1').getBoundingClientRect();
      return {hscroll:d.scrollWidth>d.clientWidth?d.scrollWidth-d.clientWidth:0,scrollY:Math.round(scrollY),mapTop:Math.round(m.top+scrollY),mapBottom:Math.round(m.bottom+scrollY),titleBottom:Math.round(h.bottom+scrollY),vh:innerHeight}}""")
    print(fn,info,'ERRORS' if errs else '',errs[:3])
    await ctx.close()
async def main():
    out=sys.argv[1]; os.makedirs(out,exist_ok=True)
    darks=sys.argv[2:] or ['phone-l5']
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        for size in SIZES:
            for name in ('first','l5','learn'): await shot(b,out,size,name)
        await shot(b,out,'phone','full')
        for d in darks:
            size,name=d.split('-'); await shot(b,out,size,name,dark=True)
        await b.close()
asyncio.run(main())
