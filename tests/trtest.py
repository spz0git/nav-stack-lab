# The Train tab (Tools → Train) end to end in the browser: for each block, collect a small dataset, train a small
# network for two epochs, save it and use it, check that the run uses it and that it survives a reload; then the map on
# screen as a source, a random-obstacle source and the JSON round trip. Prints ERRORS [] when everything held.
#   python3 tests/trtest.py [--shots DIR]   (DIR: screenshots of the tab at each step)
import asyncio,os,sys,json
from playwright.async_api import async_playwright
from _browser import launch,page_url
SHOTS=sys.argv[sys.argv.index('--shots')+1] if '--shots' in sys.argv else None
ERR=[]
def check(ok,msg):
    print(('ok   ' if ok else 'FAIL ')+msg,flush=True)
    if not ok: ERR.append(msg)
async def shot(pg,name):
    if SHOTS:
        os.makedirs(SHOTS,exist_ok=True); await pg.screenshot(path=os.path.join(SHOTS,name+'.png'),full_page=False)
async def open_tab(pg,tab):
    if await pg.locator('#tab-'+tab).is_visible(): await pg.click('#tab-'+tab)
    else:
        await pg.click('#tab-more'); await pg.click('#tab-'+tab)
    await pg.wait_for_timeout(150)
async def set_num(pg,sel,v):
    el=pg.locator(sel).first; await el.fill(str(v)); await el.dispatch_event('change'); await pg.wait_for_timeout(60)
async def one_source(pg,runs,secs):
    while await pg.locator('[data-trdel]').count()>1:
        await pg.locator('[data-trdel]').last.click(); await pg.wait_for_timeout(50)
    await set_num(pg,'[data-trow="0"][data-f="runs"]',runs)
    await set_num(pg,'[data-trow="0"][data-f="secs"]',secs)
async def collect(pg,timeout=120):
    await pg.click('#trn-collect')
    for _ in range(timeout*5):
        await pg.wait_for_timeout(200)
        if await pg.locator('.trn-ok').count() and not await pg.locator('#trn-stop:not([hidden])').count(): return True
    return False
async def train(pg,shape,epochs,timeout=240):
    await pg.click(f'#trn-arch button[data-v="{shape}"]')
    await set_num(pg,'[data-thp="epochs"]',epochs)
    await pg.click('#trn-train')
    for _ in range(timeout*5):
        await pg.wait_for_timeout(200)
        if await pg.locator('#trn-save').count(): return True
    return False
async def main():
    async with async_playwright() as p:
        b=await launch(p); ctx=await b.new_context(viewport={'width':1440,'height':900},accept_downloads=True); pg=await ctx.new_page()
        perr=[]; pg.on('pageerror',lambda e: perr.append(str(e)))
        await pg.goto(page_url()); await pg.wait_for_timeout(800)
        await open_tab(pg,'train'); await shot(pg,'1-train-tab')
        check(await pg.locator('#trn-block button[aria-pressed="true"]').inner_text()=='People detector','the tab opens on the people detector')
        check('Built-in' in await pg.locator('.trn-models').inner_text(),'the built-in detector is listed as the baseline')
        n0=await pg.locator('.trn-src').count(); check(n0==2,f'two default detector sources (the levels with people): {n0}')
        # detector: one source, two short runs, a small network, two epochs
        await one_source(pg,2,20)
        check(await collect(pg),'detector data collected')
        line=await pg.locator('#trn-data').inner_text(); print('     ',line)
        check('Held out' in line,'the last run of the first source is held out')
        check(await train(pg,'small',2),'detector trained (two epochs)'); await shot(pg,'2-detector-trained')
        res=await pg.locator('.trn-result').first.inner_text(); print('     ',res.replace('\n',' | ')[:300])
        check('Built-in' in res and 'This model' in res,'the result compares with the built-in model on the held-out run')
        check(await pg.locator('#cv-trn').count()==1,'the training curve is drawn')
        await pg.click('#trn-saveuse'); await pg.wait_for_timeout(300)
        ml=await pg.locator('.trn-models').inner_text()
        check('det1' in ml and 'IN USE' in ml.upper(),'saved as det1 and in use')
        await open_tab(pg,'per')
        seg=pg.locator('.seg[data-k="detModel"] button[aria-pressed="true"]')
        check(await seg.count()==1 and await seg.get_attribute('data-v')=='det1','Perceive shows the trained detector picked')
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(2500); await pg.keyboard.press('Space')
        # the pick survives a level change: L6, the learned detector again, still det1
        await pg.click('#lvl-btn'); await pg.click('.lvl[data-i="5"]'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        await pg.click('.seg[data-k="agents"] button[data-v="learned"]'); await pg.wait_for_timeout(200)
        seg=pg.locator('.seg[data-k="detModel"] button[aria-pressed="true"]')
        check(await seg.count()==1 and await seg.get_attribute('data-v')=='det1','after a level change the trained detector is still picked')
        # policy: one source, two runs, small network
        await open_tab(pg,'train'); await pg.click('#trn-block button[data-v="policy"]'); await pg.wait_for_timeout(150)
        await one_source(pg,2,40)
        check(await collect(pg),'policy data collected')
        check(await train(pg,'small',2),'policy trained (two epochs)'); await shot(pg,'3-policy-trained')
        await pg.click('#trn-saveuse'); await pg.wait_for_timeout(300)
        await open_tab(pg,'plan')
        seg=pg.locator('.seg[data-k="polModel"] button[aria-pressed="true"]')
        check(await seg.count()==1 and await seg.get_attribute('data-v')=='pol1','Plan runs the trained policy (pol1)')
        # JSON round trip: download, import it back as a new model
        await open_tab(pg,'train')
        async with pg.expect_download() as dl: await pg.click('[data-tdl="pol1"]')
        d=await dl.value; path=await d.path(); j=json.load(open(path))
        check(j['name']=='policy' and len(j['layers'])==3 and j['params']>0,'JSON in the src/models format')
        await pg.set_input_files('#trn-import',path); await pg.wait_for_timeout(400)
        check('pol2' in await pg.locator('.trn-models').inner_text(),'the JSON imports back as pol2')
        # the map on screen and random obstacles as sources (one short run each)
        await pg.click('#trn-clear'); await pg.wait_for_timeout(100)
        await one_source(pg,1,20)
        await pg.select_option('[data-trow="0"][data-f="map"]','screen'); await pg.wait_for_timeout(100)
        await set_num(pg,'[data-trow="0"][data-f="random"]',8)
        check(await collect(pg),'a source on the map on screen with random obstacles collects')
        # survives a reload
        await pg.reload(); await pg.wait_for_timeout(1200); await open_tab(pg,'train')
        await pg.click('#trn-block button[data-v="detector"]'); await pg.wait_for_timeout(150)
        check('det1' in await pg.locator('.trn-models').inner_text(),'the trained detector is still there after a reload')
        await shot(pg,'4-after-reload')
        for e in perr: ERR.append('page error: '+e)
        await b.close()
asyncio.run(main())
print('ERRORS',ERR)
sys.exit(1 if ERR else 0)
