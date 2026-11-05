import asyncio, sys
from playwright.async_api import async_playwright
from _browser import launch, page_url
# The smoke test (about 30 s): the page loads, every tab of Simulate opens and fills its pane, on every level, at a
# desktop and a phone width; the pipeline tabs' row hides nothing (More stays in view); Analyze and Learn open; a short
# run steps without a page error. run_all.py --changed runs it for every change to the page, before the scoped tests.
TABS = '''() => [...document.querySelectorAll('#tabs .tab[role="tab"]')].map(b => b.id.slice(4))'''
MORE = '''() => [...document.querySelectorAll('.tm-item')].map(b => b.id.slice(4))'''
async def tabs_ok(pg, where, bad):
    for t in await pg.evaluate(TABS):
        await pg.click('#tab-' + t); await pg.wait_for_timeout(60)
        n = await pg.evaluate("document.querySelector('#pane') ? document.querySelector('#pane').innerText.trim().length : 0")
        if n < 20: bad.append(f'{where}: the {t} tab is empty')
    for t in await pg.evaluate(MORE):
        await pg.evaluate(f"document.querySelector('#tab-{t}.tm-item').click()"); await pg.wait_for_timeout(80)  # the menu closes after each pick
        n = await pg.evaluate("document.querySelector('#pane') ? document.querySelector('#pane').innerText.trim().length : 0")
        if n < 20: bad.append(f'{where}: the {t} tab (More) is empty')
    r = await pg.evaluate('''() => {const t = document.querySelector('.console .tabs'), m = document.querySelector('#tab-more').getBoundingClientRect(),
        c = t.getBoundingClientRect(); return [t.scrollWidth, t.clientWidth, Math.round(m.right), Math.round(c.right)]}''')
    if r[0] > r[1] + 1 or r[2] > r[3] + 1: bad.append(f'{where}: the tab row overflows its panel (More hidden): {r}')
# On a phone the level menu opens in the page under the level button and scrolls with it (a fixed sheet that scrolled
# on its own left the page stuck in the Claude app on iPhone); picking a floor keeps it open, a touch elsewhere does
# not close it (it may start a scroll), its × does, and nothing scrolls the page by itself on the way.
async def level_menu_ok(pg, where, bad):
    await pg.evaluate("document.getElementById('lvl-btn').scrollIntoView({block: 'center'})")
    await pg.click('#lvl-btn'); await pg.wait_for_timeout(200)
    # the pick moves no scroll itself (no focus, no scroll anchoring): on iPhone a scroll moved by the page while the
    # finger was on the menu left the page unable to scroll up
    y0 = await pg.evaluate('scrollY')
    await pg.evaluate('''document.querySelector('.lvl[data-i="3"]').click()'''); await pg.wait_for_timeout(400)
    y1 = await pg.evaluate('scrollY')
    if abs(y1 - y0) > 1: bad.append(f'{where}: picking a level scrolled the page ({y0} -> {y1})')
    r = await pg.evaluate('''() => {const m = document.getElementById('lvlmenu'), x = document.getElementById('lvl-x').getBoundingClientRect();
        return {open: !m.hidden, pos: getComputedStyle(m).position, after: m.previousElementSibling && m.previousElementSibling.id, x: x.width > 0}}''')
    if not r['open']: bad.append(f'{where}: the level menu closed when a level was picked')
    if r['pos'] != 'static' or r['after'] != 'levels': bad.append(f'{where}: the level menu is not in the page under the level button: {r}')
    if not r['x']: bad.append(f'{where}: the level menu has no close button: {r}')
    await pg.dispatch_event('.tele', 'pointerdown'); await pg.wait_for_timeout(100)
    if await pg.evaluate("document.getElementById('lvlmenu').hidden"): bad.append(f'{where}: a touch outside closed the level menu')
    await pg.click('#lvl-x'); await pg.wait_for_timeout(150)
    if not await pg.evaluate("document.getElementById('lvlmenu').hidden"): bad.append(f'{where}: the level menu × does not close it')
async def main():
    async with async_playwright() as p:
        b = await launch(p)
        bad = []
        for name, (w, h) in {'desktop': (1440, 900), 'narrow desktop': (1024, 768), 'phone': (390, 844)}.items():
            pg = await b.new_page(viewport={'width': w, 'height': h}); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append('C:' + m.text) if m.type == 'error' and 'ERR_' not in m.text else None)
            await pg.goto(page_url()); await pg.wait_for_timeout(600)
            if name == 'phone':
                await pg.click('#sheetbtn'); await pg.wait_for_timeout(200)
                await tabs_ok(pg, name, bad)
                await pg.click('#sheetbtn'); await pg.wait_for_timeout(200)  # the sheet closed again
                await level_menu_ok(pg, name, bad)
            else:
                for lvl in range(await pg.evaluate('window.__nav.LEVELS.length')):
                    await pg.evaluate(f'window.__nav.switchLevel({lvl})'); await pg.wait_for_timeout(150)
                    await tabs_ok(pg, f'{name} L{lvl + 1}', bad)
                    await pg.evaluate('window.__nav.advance(40)')
                await pg.click('#mode-an'); await pg.wait_for_timeout(300)
                await pg.click('#tab-learn'); await pg.wait_for_timeout(300)
                await pg.click('#mode-sim'); await pg.wait_for_timeout(200)
            bad += [f'{name}: {e}' for e in errs]
            print(name, 'checked')
            await pg.close()
        print('ERRORS', bad); await b.close()
        return bad
sys.exit(1 if asyncio.run(main()) else 0)
