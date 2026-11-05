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
# On a phone the level menu is a sheet over most of the screen: it clears the bottom bar, a swipe that reaches its end
# does not scroll the page hidden behind it (the page looked stuck), and its × closes it.
async def level_menu_ok(pg, where, bad):
    await pg.evaluate("document.getElementById('lvl-btn').scrollIntoView({block: 'center'})")
    await pg.click('#lvl-btn'); await pg.wait_for_timeout(200)
    await pg.click('.lvl[data-i="3"]'); await pg.wait_for_timeout(400)
    r = await pg.evaluate('''() => {const m = document.getElementById('lvlmenu'), s = getComputedStyle,
        x = document.getElementById('lvl-x').getBoundingClientRect();
        return {open: !m.hidden, bot: m.getBoundingClientRect().bottom, bar: document.querySelector('.bottombar').getBoundingClientRect().top,
          x: x.width > 0, contain: ['.lvlmenu', '.lvl-list', '.brief'].every(q => s(document.querySelector(q)).overscrollBehaviorY === 'contain')}}''')
    if not r['open']: bad.append(f'{where}: the level menu closed when a level was picked')
    if r['bot'] > r['bar'] + 1: bad.append(f'{where}: the level menu runs under the bottom bar: {r}')
    if not r['x'] or not r['contain']: bad.append(f'{where}: the level menu has no close button or lets swipes scroll the page: {r}')
    await pg.click('#lvl-x'); await pg.wait_for_timeout(150)
    if not await pg.evaluate("document.getElementById('lvlmenu').hidden"): bad.append(f'{where}: the level menu × does not close it')
# Idle, the page changes nothing: rewriting the same status and metrics several times a second made iPhone lay the page
# out again each time, the page height moved by 1 px back and forth, and at the bottom of the page that moved the scroll
# position under the finger so it could not scroll up (after a floor switch, the level button being last on the page).
async def idle_quiet(pg, where, bad):
    await pg.evaluate("window.__nav.switchLevel(4)"); await pg.wait_for_timeout(400)
    n = await pg.evaluate('''() => new Promise(res => { const out = []; const mo = new MutationObserver(ms => ms.forEach(m => out.push((m.target.id || m.target.parentElement && m.target.parentElement.id || '?') + ':' + m.type)));
        mo.observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true}); setTimeout(() => { mo.disconnect(); res(out); }, 1000); })''')
    if n: bad.append(f'{where}: idle, the page still rewrites itself ({len(n)} changes in 1 s, e.g. {sorted(set(n))[:6]})')
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
                await idle_quiet(pg, name, bad)
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
