import asyncio,os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        pg=await b.new_page(viewport={'width':1280,'height':800}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('C:'+m.text) if m.type=='error' and 'ERR_' not in m.text else None)
        await pg.goto('file://'+os.path.abspath('wrapped.html')); await pg.wait_for_timeout(700)
        await pg.screenshot(path='p1_first.png')
        print('status',await pg.evaluate("document.querySelector('#status').innerText"))
        # Try button: L1 item 1 button 1
        await pg.click('#brief .try summary'); await pg.wait_for_timeout(100); await pg.screenshot(path='p1_try.png')
        await pg.click('button[data-lt="0:1"]'); await pg.wait_for_timeout(1500)
        print('after try: running',await pg.evaluate("window.__nav.P.ppL0"),await pg.evaluate("document.querySelector('#status').innerText"),'hint hidden',await pg.evaluate("document.querySelector('#firstrun').hidden"))
        await pg.screenshot(path='p1_running.png')
        # keyboard: space pauses
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(100)
        t1=await pg.evaluate("window.__nav.S.t"); await pg.wait_for_timeout(400); t2=await pg.evaluate("window.__nav.S.t"); print('paused by space',t1==t2)
        # zoom via wheel at the robot, hover
        box=await pg.locator('#map').bounding_box()
        rx,ry=await pg.evaluate("[window.__nav.S.robot.x,window.__nav.S.robot.y]")
        sx=box['x']+rx/24*box['width']; sy=box['y']+(16-ry)/16*box['height']
        await pg.mouse.move(sx,sy); await pg.mouse.wheel(0,-300); await pg.wait_for_timeout(200)
        await pg.mouse.move(sx+1,sy+1); await pg.wait_for_timeout(150)
        print('zoom',await pg.evaluate("[document.querySelector('#maptip').hidden,document.querySelector('#maptip').innerText.slice(0,60)]"))
        await pg.screenshot(path='p1_zoom.png')
        # pan by drag
        await pg.mouse.move(sx+100,sy+100); await pg.mouse.down(); await pg.mouse.move(sx+160,sy+140,steps=5); await pg.mouse.up(); await pg.wait_for_timeout(100)
        print('goals after pan-drag (should be unchanged 4):',await pg.evaluate("window.__nav.WPS.length"))
        # click adds goal when zoomed
        p=await pg.evaluate("(()=>{const r=document.querySelector('#map').getBoundingClientRect();const [x,y]=window.__nav.toScreen?window.__nav.toScreen(4,3):[0,0];return [r.left+x,r.top+y]})()")
        await pg.mouse.click(p[0],p[1]); await pg.wait_for_timeout(100); print('goals after click at (4,3):',await pg.evaluate("window.__nav.WPS.length"),await pg.evaluate("window.__nav.WPS.at(-1)"))
        await pg.keyboard.press('0'); await pg.wait_for_timeout(100)
        # second channel + param reset mark
        await pg.select_option('#plotsel2','v'); await pg.wait_for_timeout(200)
        await pg.click('#tab-ctl'); await pg.wait_for_timeout(200); await pg.screenshot(path='p1_ctl.png')
        print('chg fields',await pg.evaluate("document.querySelectorAll('.field.chg').length"),'reset btn',await pg.evaluate("!!document.querySelector('[data-reset=ppL0]')"))
        await pg.click('[data-reset=ppL0]'); await pg.wait_for_timeout(100); print('ppL0 after reset',await pg.evaluate("window.__nav.P.ppL0"))
        # kidnap flow via L3 try
        await pg.evaluate("window.__nav.loadLevel(2)"); await pg.wait_for_timeout(100)
        if not await pg.evaluate("document.querySelector('#brief .try').open"): await pg.click('#brief .try summary')
        await pg.click('button[data-lt="3:0"]'); await pg.wait_for_timeout(2500)
        print('L3 kidnap log:',await pg.evaluate("window.__nav.S.log.filter(l=>/kidnap/i.test(l.msg)).map(l=>l.t.toFixed(1)+' '+l.msg)"))
        await pg.keyboard.press('Space')
        # pause on contact: L2 straight line
        await pg.evaluate("window.__nav.loadLevel(1)"); await pg.check('#pausec')
        if not await pg.evaluate("document.querySelector('#brief .try').open"): await pg.click('#brief .try summary')
        await pg.click('button[data-lt="0:0"]'); await pg.wait_for_timeout(6000)
        print('pause on contact:',await pg.evaluate("[window.__nav.S.coll, window.__nav.S.log[0].msg]"), 'still running?',await pg.evaluate("(()=>{const a=window.__nav.S.t;return new Promise(r=>setTimeout(()=>r(window.__nav.S.t!==a),400))})()"))
        # analysis + mobile
        await pg.keyboard.press('a'); await pg.wait_for_timeout(600); await pg.screenshot(path='p1_an.png')
        m=await b.new_page(viewport={'width':390,'height':844},device_scale_factor=2); await m.goto('file://'+os.path.abspath('wrapped.html')); await m.wait_for_timeout(500)
        print('mobile sw',await m.evaluate("document.documentElement.scrollWidth")); await m.screenshot(path='p1_mob.png')
        print('ERR',errs); await b.close()
asyncio.run(main())
