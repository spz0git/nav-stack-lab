# Levels as data in the browser (the level menu's Custom entry, ui/levelmenu.js): generate a level of each family at
# two sizes from the menu and drive its mission to the end, follow the links that carry a generated and an imported
# level, export a level with a painted cell and import it back, keep it in the browser across a reload, collect Train
# data on generated worlds, and check that the built-in levels and the Learn links still open as before.
# Prints ERRORS [] when everything held.
#   python3 tests/lvtest.py
import asyncio,json,os,tempfile
from playwright.async_api import async_playwright
from _browser import launch,page_url
ERR=[]
def check(ok,msg):
    print(('ok   ' if ok else 'FAIL ')+msg,flush=True)
    if not ok: ERR.append(msg)
DRIVE=r'''async (secs) => {
  const N=window.__nav;
  document.querySelector('#run').click(); document.querySelector('#run').click(); // run then pause: starts the mission
  for(let t=0;t<secs/0.05 && N.S.fsm.state!=='DONE';t+=200) await N.advance(200);
  return {state:N.S.fsm.state, t:+N.S.t.toFixed(1), done:N.WPS.filter(w=>w.done&&!w.skipped).length, goals:N.WPS.length, coll:N.S.coll,
    world:N.world, cx:N.VIEW.cx, cy:N.VIEW.cy, name:N.LV.name, id:N.LV.id};
}'''
LEVEL=r'''() => { const N=window.__nav; return {id:N.LV.id, name:N.LV.name, json:N.levelToJSON(N.LV), world:N.world, edits:N.P.mapAdd}; }'''
async def menu_custom(pg):
    if await pg.locator('#lvlmenu').is_hidden(): await pg.click('#lvl-btn')
    await pg.click('.lvl[data-cust]'); await pg.wait_for_timeout(100)
async def set_gen(pg,k,v):
    el=pg.locator(f'[data-gen="{k}"]')
    if k=='like': await el.select_option(v)
    else: await el.fill(str(v)); await el.dispatch_event('change')
async def open_tab(pg,tab):
    if await pg.locator('#tab-'+tab).is_visible(): await pg.click('#tab-'+tab)
    else:
        await pg.click('#tab-more'); await pg.click('#tab-'+tab)
    await pg.wait_for_timeout(150)
async def main():
    async with async_playwright() as p:
        b=await launch(p)
        ctx=await b.new_context(viewport={'width':1280,'height':900},accept_downloads=True)
        pg=await ctx.new_page()
        errs=[]
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto(page_url()); await pg.wait_for_timeout(800)
        await pg.evaluate("window.__nav.setLevel('advanced')")  # the Mission tab is Advanced (kept for the context)
        # 1. every family at two sizes, generated from the menu, its mission driven to the end (L2's settings: the map
        #    and the pose are known, so a run that does not finish is the level's fault)
        for fam in ['rooms','warehouse','hall']:
            for w,h in [(24,16),(48,32)]:
                await menu_custom(pg)
                await pg.click(f'#gen-fam button[data-v="{fam}"]')
                for k,v in [('w',w),('h',h),('seed',3),('people',0),('like','L2')]: await set_gen(pg,k,v)
                await pg.click('#gen-go'); await pg.wait_for_timeout(150)
                await pg.keyboard.press('Escape')
                r=await pg.evaluate(DRIVE,500)
                print('     ',fam,w,h,{k:r[k] for k in ['state','t','done','goals','coll']})
                check(r['id']=='G' and r['world'][:2]==[w,h] and r['world'][2:]==[w*10,h*10],f'{fam} {w}×{h}: the world is the level\'s size ({r["world"]})')
                check(r['cx']==w/2 and r['cy']==h/2,f'{fam} {w}×{h}: the map view fits the new world')
                check(r['state']=='DONE' and r['done']==r['goals']>0,f'{fam} {w}×{h}: the mission completes ({r["done"]}/{r["goals"]} in {r["t"]} s)')
        # 2. the link of a generated level opens the same level
        gen=await pg.evaluate(LEVEL); h=await pg.evaluate('location.hash')
        check('l=G' in h and 'gen=gen:hall' in h,'the hash carries the generator spec: '+h[:90])
        p2=await ctx.new_page(); await p2.goto(page_url(h)); await p2.wait_for_timeout(900)
        g2=await p2.evaluate(LEVEL); await p2.close()
        check(g2['json']==gen['json'] and g2['world']==gen['world'],'the generated level\'s link round-trips')
        # 3. export with a painted cell, import it back under another name
        await pg.evaluate("() => window.__nav.setParam('mapAdd','245',true)")
        await menu_custom(pg)
        async with pg.expect_download() as dl: await pg.click('#cust-export')
        d=await dl.value; j=json.load(open(await d.path()))
        check(j['format']=='nav-stack-lab-level' and j['size']==[48,32],'Export writes the level format at the level\'s size')
        check(len(j['shapes'])==len(gen['json']['shapes'])+1,'the painted cell is part of the exported level')
        j['name']='Imported hall'
        fn=os.path.join(tempfile.mkdtemp(),'level.json'); json.dump(j,open(fn,'w'))
        await pg.set_input_files('#cust-import',fn); await pg.wait_for_timeout(400)
        imp=await pg.evaluate(LEVEL)
        check(imp['id']=='C' and imp['name']=='Imported hall' and imp['edits']=='','Import loads the level (its painted cell now part of the map)')
        check(len(imp['json']['shapes'])==len(j['shapes']) and imp['json']['goals']==j['goals'],'the imported level is the exported one')
        check(await pg.locator('.lvl[data-c]').count()==1,'the imported level is kept in the menu')
        # 4. the link of an imported level carries it compressed and opens the same level
        await pg.click('#cust-link'); await pg.wait_for_timeout(400)
        h=await pg.evaluate('location.hash')
        check('l=C' in h and 'lz=' in h,f'Copy link puts the level, compressed, in the hash ({len(h)} characters)')
        p2=await ctx.new_page(); await p2.goto(page_url(h)); await p2.wait_for_timeout(1200)
        c2=await p2.evaluate(LEVEL); await p2.close()
        check(c2['name']=='Imported hall' and c2['json']['shapes']==imp['json']['shapes'] and c2['world']==[48,32,480,320],'the imported level\'s link round-trips')
        # 5. kept across a reload (IndexedDB)
        await pg.goto(page_url()); await pg.wait_for_timeout(1200)
        await pg.click('#lvl-btn'); await pg.wait_for_timeout(150)
        check(await pg.locator('.lvl[data-c]').count()==1,'the kept level is still in the menu after a reload')
        await pg.click('.lvl[data-c]'); await pg.wait_for_timeout(200)
        r=await pg.evaluate(LEVEL); check(r['name']=='Imported hall','a kept level loads from the menu')
        await pg.keyboard.press('Escape')
        # 6. Train data on generated worlds: one short policy run
        await open_tab(pg,'train'); await pg.click('#trn-block button[data-v="policy"]'); await pg.wait_for_timeout(150)
        while await pg.locator('[data-trdel]').count()>1:
            await pg.locator('[data-trdel]').last.click(); await pg.wait_for_timeout(50)
        await pg.select_option('[data-trow="0"][data-f="map"]','Gwarehouse'); await pg.wait_for_timeout(100)
        for f,v in [('runs',2),('secs',20)]:
            el=pg.locator(f'[data-trow="0"][data-f="{f}"]'); await el.fill(str(v)); await el.dispatch_event('change'); await pg.wait_for_timeout(80)
        await pg.click('#trn-collect'); ok=False
        for _ in range(300):
            await pg.wait_for_timeout(200)
            if await pg.locator('.trn-ok').count() and not await pg.locator('#trn-stop:not([hidden])').count(): ok=True; break
        txt=await pg.locator('.trn-src').first.inner_text()
        check(ok and 'Collected: 2 runs' in txt,'a Train source on generated warehouses collects ('+txt.split('Collected:')[-1].strip()[:60]+')')
        # 7. the built-in levels and the Learn links as before
        await pg.goto(page_url('#l=L3&seed=9&loc=ekf')); await pg.wait_for_timeout(900)
        r=await pg.evaluate("() => ({id:__nav.LV.id, loc:__nav.P.loc, seed:__nav.P.seed, world:__nav.world, cx:__nav.VIEW.cx})")
        check(r=={'id':'L3','loc':'ekf','seed':9,'world':[24,16,240,160],'cx':12},'a built-in setup link opens as before: '+str(r))
        await pg.goto(page_url('#notes=ch1')); await pg.wait_for_timeout(900)
        check(await pg.evaluate("document.querySelector('.layout').dataset.mode")=='learn','a #notes= link still opens Learn')
        print('ERRORS',[e for e in errs if 'favicon' not in e][:10]+ERR)
        await b.close()
asyncio.run(main())
