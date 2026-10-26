# The workspace around the simulation, at 1440 × 900 (about 30 s): the timeline's replay and loop region, Runs (keep,
# compare, export and import, the previous-run ghost), the command palette, Layers, the URL hash round trip, the
# keyboard sheet's keys, dark mode's contrast, What's new, the How-it-works panels' MathML, the plot dock and its CSV,
# and the Changed badge. Each check asserts what the page shows or holds after the action, not only that nothing threw.
# Prints one summary line per area, then FAILS [...] (checks that did not hold) and ERRORS [...] (page and console
# errors); both [] when everything held.
#   python3 tests/uitest.py
import asyncio,json,os,re,sys,tempfile,time
from playwright.async_api import async_playwright
from _browser import launch,page_url,ROOT
FAILS=[]; AREA={'name':'','n':0,'bad':0}; SUMMARY=[]
def area(name):
    if AREA['name']: SUMMARY.append(f"{AREA['name']:16s} {AREA['n']-AREA['bad']}/{AREA['n']} checks held")
    AREA.update(name=name,n=0,bad=0)
    if name: print(f'--- {name}',flush=True)
def check(ok,msg):
    AREA['n']+=1; print(('ok   ' if ok else 'FAIL ')+msg,flush=True)
    if not ok: AREA['bad']+=1; FAILS.append(f"{AREA['name']}: {msg}")
VERSION=json.load(open(os.path.join(ROOT,'src','version.json')))['version']
# what the timeline and the status strip show
TL=r'''() => { const st=document.querySelector('#scrub').dataset.state, txt=document.querySelector('#scrubt').textContent,
  kv=[...document.querySelectorAll('#status .kv')].find(k=>k.firstChild.textContent==='t'), lp=document.querySelector('#tl-loop');
  const m=/^([\d.]+) \/ ([\d.]+) s/.exec(txt);
  return {state:st, txt, shown:m?+m[1]:null, end:m?+m[2]:null, statusT:kv?kv.querySelector('b').textContent:null,
    badge:!!document.querySelector('#status .st-replay'), hash:location.hash, loop:lp.hidden?null:lp.title,
    playing:document.querySelector('#scrub-play').getAttribute('aria-pressed'), t:window.__nav.S.t}; }'''
SCRUB=r'''(u) => { const r=document.querySelector('#scrubr'); r.value=String(Math.round(u*+r.max)); r.dispatchEvent(new Event('input',{bubbles:true})); }'''
START=r'''async (n) => { const N=window.__nav; document.querySelector('#run').click(); document.querySelector('#run').click(); await N.advance(n); return N.S.t; }'''
LAYERS=r'''() => ({...window.__nav.LAYERS})'''
# the contrast of an element's text against the background it sits on (the first opaque ancestor background, with
# translucent ones composited over it)
CONTRAST=r'''(sels) => {
  const rgba=s=>{const m=s.match(/[\d.]+/g)||[0,0,0,0]; return [+m[0],+m[1],+m[2],m[3]==null?1:+m[3]];};
  const lum=c=>{const f=v=>{v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]);};
  const over=(a,b)=>[0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3])).concat(1);
  const bgOf=el=>{const L=[]; for(let e=el;e;e=e.parentElement){const c=rgba(getComputedStyle(e).backgroundColor); if(c[3]>0) L.push(c); if(c[3]>=1) break;}
    let b=[255,255,255,1]; if(!L.length||L[L.length-1][3]<1) b=rgba(getComputedStyle(document.documentElement).backgroundColor); for(const c of L.reverse()) b=over(c,b); return b;};
  return sels.map(s=>{const el=document.querySelector(s); if(!el) return [s,null];
    const bg=bgOf(el), fg=over(rgba(getComputedStyle(el).color),bg), a=lum(fg), b=lum(bg);
    return [s,+((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)).toFixed(2)];});
}'''
async def blur(pg): await pg.evaluate('document.activeElement && document.activeElement.blur && document.activeElement.blur()')
async def fresh(pg,h=''):
    await pg.goto(page_url(h)); await pg.wait_for_timeout(700)
async def tab(pg,t):
    await pg.click('#tab-'+t); await pg.wait_for_timeout(80)
async def main():
    t_start=time.time()
    async with async_playwright() as p:
        b=await launch(p)
        ctx=await b.new_context(viewport={'width':1440,'height':900},accept_downloads=True,color_scheme='light')
        pg=await ctx.new_page(); errs=[]
        def watch(q):
            q.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'favicon' not in m.text else None)
            q.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        watch(pg)
        pg.set_default_timeout(8000)
        try:
            await fresh(pg)

            # ---- the Changed badge: a setting changed from the panel counts, its ↺ puts it back
            area('Changed')
            n0=await pg.inner_text('#chg-n')
            await tab(pg,'loc'); await pg.click('#pane [data-k="loc"] button[data-v="ekf"]'); await pg.wait_for_timeout(200)
            check(n0=='0' and await pg.inner_text('#chg-n')=='1','the badge counts the changed setting (0 → '+await pg.inner_text('#chg-n')+')')
            await pg.click('#tg-chg'); await pg.wait_for_timeout(80)
            row=await pg.locator('#chgpanel li:has([data-rst="loc"])').inner_text()
            check('EKF' in row and 'Ground truth' in row,'Changed lists it with the new and the default value: '+row.replace('\n',' '))
            await pg.click('#chgpanel [data-rst="loc"]'); await pg.wait_for_timeout(200)
            check(await pg.evaluate('window.__nav.P.loc')=='truth' and await pg.inner_text('#chg-n')=='0','its reset puts the default back and the badge to 0')
            await pg.click("#tg-chg"); await pg.wait_for_timeout(50)

            # ---- the keyboard sheet: the keys it lists do what it says
            area('Keyboard sheet')
            await blur(pg); await pg.keyboard.press('?'); await pg.wait_for_timeout(100)
            sheet=await pg.evaluate('''() => { const d=document.querySelector('#keysdlg'); return {open:!!(d&&d.open), rows:d?[...d.querySelectorAll('dt')].map(t=>[t.innerText.replace(/\\s+/g,' ').trim(), t.nextElementSibling.innerText]):[]}; }''')
            keys=dict(sheet['rows'])
            check(sheet['open'] and len(keys)>=15,f'? opens the sheet ({len(keys)} rows)')
            for k,d in [('Space','Run or pause'),('N','Step 0.5 s'),('R','Reset'),('F','Follow the robot'),('A','Simulate ⇄ Analyze'),('V G H K B','Select · Goal')]:
                check(k in keys and keys[k].startswith(d),f'the sheet lists {k}: {keys.get(k)}')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(80)
            check(not await pg.evaluate("document.querySelector('#keysdlg').open"),'Escape closes the sheet')
            await blur(pg)
            await pg.keyboard.press(' '); await pg.wait_for_timeout(700)
            r1=await pg.evaluate("[document.querySelector('#run').textContent, window.__nav.S.t]")
            await pg.keyboard.press(' '); await pg.wait_for_timeout(100)
            t1=await pg.evaluate('window.__nav.S.t'); await pg.wait_for_timeout(300); t2=await pg.evaluate('window.__nav.S.t')
            check(r1[0]=='Pause' and r1[1]>0.2,f'Space runs (button says {r1[0]}, t {r1[1]:.2f} s)')
            check(t1==t2 and await pg.inner_text('#run')=='Run',f'Space again pauses (t stays {t2:.2f} s)')
            await pg.keyboard.press('n'); await pg.wait_for_timeout(300); t3=await pg.evaluate('window.__nav.S.t')
            check(abs(t3-t2-0.5)<0.01,f'N steps 0.5 s ({t2:.2f} → {t3:.2f} s)')
            await pg.keyboard.press('r'); await pg.wait_for_timeout(200)
            check(await pg.evaluate('window.__nav.S.t')==0 and '0.0 s' in await pg.inner_text('#status'),'R resets the run to 0.0 s')
            await pg.keyboard.press('f'); await pg.wait_for_timeout(80)
            f1=await pg.evaluate("[window.__nav.VIEW.follow, document.querySelector('#mv-follow').getAttribute('aria-pressed')]")
            await pg.keyboard.press('f'); await pg.wait_for_timeout(80)
            f2=await pg.evaluate("[window.__nav.VIEW.follow, document.querySelector('#mv-follow').getAttribute('aria-pressed')]")
            check(f1==[True,'true'] and f2==[False,'false'],f'F follows the robot and F again stops ({f1} → {f2})')
            await pg.keyboard.press('a'); await pg.wait_for_timeout(250)
            m1=await pg.evaluate("[window.__an.AN.mode]")
            await pg.keyboard.press('a'); await pg.wait_for_timeout(250)
            m2=await pg.evaluate("window.__an.AN.mode")
            check(m1[0]=='an' and m2=='sim',f'A switches to Analyze and back ({m1[0]} → {m2})')
            await pg.keyboard.press('v'); v1=await pg.evaluate("document.querySelector('#map').dataset.tool")
            await pg.keyboard.press('g'); v2=await pg.evaluate("document.querySelector('#map').dataset.tool")
            check(v1=='select' and v2=='wp',f'V picks Select and G Goal (map tool {v1} → {v2})')

            # ---- the timeline: replay a moment, the loop region, back to live
            area('Replay and loop')
            t=await pg.evaluate(START,200); await pg.wait_for_timeout(200)
            s=await pg.evaluate(TL)
            check(t>9.9 and s['state']=='live' and s['txt']==f'{t:.1f} s · live' and not s['badge'],f'after {t:.1f} s the timeline is live: "{s["txt"]}"')
            await pg.evaluate(SCRUB,0.4); await pg.wait_for_timeout(400)
            s=await pg.evaluate(TL)
            check(s['state']=='replay' and s['badge'],'scrubbing shows the REPLAY badge and the replay state')
            check(s['shown'] is not None and 3<s['shown']<5.5 and s['end']==round(t,1),f'the timeline reads the scrubbed moment: "{s["txt"]}"')
            check(s['statusT']==f"{s['shown']:.1f} s",f'the status strip shows that moment ({s["statusT"]})')
            check(f"&t={s['shown']:.1f}" in s['hash'],'the hash carries t= while replaying: '+s['hash'])
            check(abs(s['t']-t)<1e-9,'the live run is untouched underneath (S.t is still the live time)')
            a=s['shown']; await pg.keyboard.press(','); await pg.wait_for_timeout(80)
            s=await pg.evaluate(TL); check(abs(s['shown']-(a-0.1))<0.051,f', steps back 0.1 s ({a} → {s["shown"]})')
            a=s['shown']; await pg.keyboard.press('i')
            await pg.evaluate(SCRUB,0.75); await pg.wait_for_timeout(80); bpt=(await pg.evaluate(TL))['shown']
            await pg.keyboard.press('o'); await pg.wait_for_timeout(80)
            s=await pg.evaluate(TL)
            check(s['loop']==f'Loop {a:.1f}–{bpt:.1f} s',f'I and O set the loop region ({s["loop"]}, expected {a:.1f}–{bpt:.1f})')
            await pg.keyboard.press(']'); await pg.keyboard.press(']')
            check(await pg.evaluate("document.querySelector('#speed').value")=='4','] twice sets the speed to 4×')
            await pg.keyboard.press('p'); seen=[]
            for _ in range(26):
                await pg.wait_for_timeout(100); seen.append((await pg.evaluate(TL))['shown'])
            s=await pg.evaluate(TL)
            inside=all(x is not None and a-0.051<=x<=bpt+0.051 for x in seen)
            wraps=sum(1 for x,y in zip(seen,seen[1:]) if y<x-0.5)
            check(s['playing']=='true' and inside,f'P plays inside the loop (shown {min(seen)}–{max(seen)} s)')
            check(wraps>=1,f'playback wraps at the out point ({wraps} wraps in 2.6 s at 4×)')
            await pg.keyboard.press('p'); await pg.wait_for_timeout(80)
            x1=(await pg.evaluate(TL))['shown']; await pg.wait_for_timeout(250); s=await pg.evaluate(TL)
            check(s['playing']=='false' and s['shown']==x1,'P again pauses the playback')
            await pg.evaluate("document.querySelector('#tl-loop .tl-x').click()"); await pg.wait_for_timeout(80)
            check((await pg.evaluate(TL))['loop'] is None,'× clears the loop region')
            await pg.click('#scrub-live'); await pg.wait_for_timeout(400)
            s=await pg.evaluate(TL)
            check(s['state']=='live' and not s['badge'] and s['txt']==f'{t:.1f} s · live','Live returns to the live state: "'+s['txt']+'"')
            check('t=' not in s['hash'].replace('seed=',''),'the hash loses t= on Live: '+s['hash'])
            await pg.keyboard.press('['); await pg.keyboard.press('[')

            # ---- Runs: keep, the ghost after Reset, compare, export and import
            area('Runs')
            nr=int(await pg.inner_text('#runs-n'))  # runs that ended before (the keyboard's Reset)
            await pg.click('#tg-runs'); await pg.wait_for_timeout(80)
            await pg.fill('#run-name','uitest kept'); await pg.click('#run-keepnow button[type="submit"]'); await pg.wait_for_timeout(100)
            kept=await pg.locator('#runpanel ul.runs').first.inner_text()
            check('uitest kept' in kept and await pg.inner_text('#runs-n')==str(nr+1),f'Keep this run lists it under Kept and the badge counts it ({nr} → {nr+1})')
            await pg.focus('#run-name'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(50)
            check(await pg.is_hidden('#runpanel'),'Escape in the panel closes it')
            await pg.click('#resetb'); await pg.wait_for_timeout(250)
            g=await pg.evaluate("[!document.querySelector('#ghostchip').hidden, document.querySelector('#ghostchip').innerText, window.__nav.LAYERS.ghostrun, window.__nav.GHOST && window.__nav.GHOST.level]")
            check(g[0] and 'Previous run (10 s)' in g[1] and g[2] and g[3]=='L1',f'after Reset the previous run is on the map: {g[1].strip()[:40]!r}, layer on')
            await pg.evaluate(START,120); await pg.wait_for_timeout(150)
            await pg.click('#tg-runs'); await pg.wait_for_timeout(80)
            kept=await pg.locator('#runpanel li.run').all_inner_texts()
            check(any('uitest kept' in k and '10 s' in k for k in kept),'the kept run is listed with its full length after the run ended')
            await pg.click('#runpanel li.run:has-text("uitest kept") [data-cmp]'); await pg.wait_for_timeout(150)
            rows=await pg.evaluate("[...document.querySelectorAll('#run-cmp .cmptab tbody tr')].map(r=>[...r.cells].map(c=>c.textContent))")
            dist=[r for r in rows if r[0].startswith('Distance')]
            check(len(rows)==12 and dist and dist[0][1]!='—' and dist[0][2]!='—' and re.match(r'^[+-]?\d',dist[0][3] or 'x'),f'Compare fills the Δ table ({len(rows)} rows; distance {dist[0] if dist else None})')
            async with pg.expect_download() as dl: await pg.click('#runpanel li.run:has-text("uitest kept") [data-exp]')
            d=await dl.value; j=json.load(open(await d.path()))
            r=j.get('run',{})
            check(j.get('format')=='nav-stack-lab-run' and r.get('name')=='uitest kept' and r.get('level')=='L1' and len(r.get('F',[]))>=90 and len(r.get('trailT',[]))>10,
                  f'Export writes the run as JSON ({d.suggested_filename}, {len(r.get("F",[]))} frames)')
            r['name']='uitest imported'; fn=os.path.join(tempfile.mkdtemp(),'run.json'); json.dump(j,open(fn,'w'))
            await pg.set_input_files('#run-file',fn); await pg.wait_for_timeout(300)
            kept=await pg.locator('#runpanel li.run').all_inner_texts()
            check(any('uitest imported' in k for k in kept) and await pg.inner_text('#runs-n')==str(nr+2),f'Import adds the run back under Kept (badge {nr+2})')
            await pg.click('#tg-runs'); await pg.wait_for_timeout(50)

            # ---- the plot dock: a pane with a signal from the browser, and the CSV
            area('Plot dock')
            await pg.click('#pl-more'); await pg.click('#pl-add'); await pg.wait_for_timeout(150)
            check(await pg.is_visible('#sigbrowser') and await pg.locator('.ppane').count()==1,'+ Plot adds a pane and opens the signal browser')
            await pg.fill('#sb-q','speed'); await pg.wait_for_timeout(50)
            vis=await pg.evaluate("[...document.querySelectorAll('#sigbrowser .sb-row')].filter(l=>!l.hidden).map(l=>l.dataset.name)")
            check(vis and all('speed' in v for v in vis),f'the browser\'s search filters the signals ({len(vis)} match "speed")')
            await pg.check('#sigbrowser input[data-sig="va"]'); await pg.wait_for_timeout(300)
            await pg.keyboard.press('Escape')
            pane=await pg.evaluate('''() => { const p=document.querySelector('.ppane'), c=p.querySelector('canvas'), g=c.getContext('2d').getImageData(0,0,c.width,c.height).data, seen=new Set();
              for(let i=0;i<g.length;i+=4*7) seen.add(g[i]+','+g[i+1]+','+g[i+2]); return {chip:p.querySelector('.pp-chip') && p.querySelector('.pp-chip').innerText, colours:seen.size, w:c.width}; }''')
            check(pane['chip'] and pane['chip'].startswith('Speed') and re.search(r'\d',pane['chip']),f'the legend names the signal with its value: {pane["chip"]!r}')
            check(pane['w']>100 and pane['colours']>=4,f'the pane\'s canvas is drawn ({pane["colours"]} colours)')
            await pg.click('#pl-more')
            async with pg.expect_download() as dl: await pg.click('#pl-csv')
            d=await dl.value; lines=open(await d.path()).read().split('\n'); head=lines[0].split(',')
            ok=all(len(l.split(','))==len(head) for l in lines[1:]); ts=[float(l.split(',')[0]) for l in lines[1:]]
            check(head[0]=='t' and 'va [m/s]' in head and len(lines)>=50 and ok and ts==sorted(ts),f'CSV: a header of {len(head)} columns and {len(lines)-1} rows, times in order')

            # ---- the command palette
            area('Palette')
            await blur(pg); await pg.keyboard.press('Control+k'); await pg.wait_for_timeout(100)
            check(await pg.is_visible('#palette') and await pg.evaluate("document.activeElement.id")=='pal-q','Ctrl+K opens the palette with the search field focused')
            await pg.keyboard.type('particles'); await pg.wait_for_timeout(80)
            res=await pg.evaluate("[...document.querySelectorAll('#pal-list li[data-i]')].map(l=>[l.querySelector('.pal-name').textContent,l.querySelector('.pal-kind').textContent])")
            check(res and res[0]==['Particles','Setting · Localize'] and re.match(r'\d+\+? results',await pg.inner_text('#pal-hint')),f'typing a setting name finds it first: {res[:2]}')
            await pg.keyboard.press('Enter'); await pg.wait_for_timeout(250)
            tst=await pg.evaluate("document.querySelector('#toast') && !document.querySelector('#toast').hidden ? document.querySelector('#toast').textContent : ''")
            check(await pg.is_hidden('#palette') and await pg.get_attribute('#tab-loc','aria-selected')=='true' and 'Localize' in tst and 'Particle filter' in tst,
                  f'Enter opens its tab and says what reveals it: {tst[:80]!r}')
            before=(await pg.evaluate(LAYERS))['cost']
            await blur(pg); await pg.keyboard.press('/'); await pg.wait_for_timeout(80); await pg.keyboard.type('layer costmap'); await pg.wait_for_timeout(80)
            first=await pg.inner_text('#pal-list li[data-i="0"] .pal-name')
            await pg.click('#pal-list li[data-i="0"]'); await pg.wait_for_timeout(150)
            check(first=='Layer: Costmap' and (await pg.evaluate(LAYERS))['cost']==(not before),f'/ opens it too; picking "{first}" toggles the costmap layer ({before} → {not before})')
            await pg.evaluate("window.__nav.LAYERS.cost=%s" % ('true' if before else 'false'))
            await blur(pg); await pg.keyboard.press('Control+k'); await pg.wait_for_timeout(80); await pg.keyboard.type('qqxqz'); await pg.wait_for_timeout(50)
            none=await pg.locator('#pal-list .pal-none').count()
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(80)
            check(none==1 and await pg.is_hidden('#palette'),'a query with no match says so; Escape in the field closes the palette')

            # ---- Layers: the tab's set, the popover, a layer that is unavailable here
            area('Layers')
            await fresh(pg)
            await tab(pg,'plan'); L1=await pg.evaluate(LAYERS)
            await tab(pg,'loc'); L2=await pg.evaluate(LAYERS)
            check(L1['search'] and not L1['belief'] and L2['belief'] and not L2['search'],'each pipeline tab sets its own layers (Plan: search; Localize: belief)')
            await blur(pg); await pg.keyboard.press('l'); await pg.wait_for_timeout(100)
            check(await pg.is_visible('#layerpop') and 'set by the tab' in await pg.inner_text('#layerpop .lp-head'),'L opens the Layers popover, "set by the tab"')
            st=await pg.evaluate('''() => Object.fromEntries([...document.querySelectorAll('#layerpop .lp-row')].map(r=>[r.querySelector('input').dataset.layer,[r.querySelector('input').checked,r.querySelector('.lp-st').textContent,r.querySelector('.lp-st').className]]))''')
            check(st['graph'][1]=='only with pose-graph SLAM (Localize)' and 'live' not in st['graph'][2],f'an unavailable layer says why: graph "{st["graph"][1]}"')
            check(st['ghostrun'][1]=='no previous run on this level','the previous-run layer says there is none yet')
            check(all(st[k][0]==L2[k] for k in st),'the popover\'s boxes match LAYERS')
            tr=L2['trail']; await pg.click('#layerpop input[data-layer="trail"]'); await pg.wait_for_timeout(80)
            check((await pg.evaluate(LAYERS))['trail']==(not tr) and 'your choice' in await pg.inner_text('#layerpop .lp-head'),'ticking a box changes LAYERS and the popover says "your choice"')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(80)
            check(await pg.is_hidden('#layerpop'),'Escape closes the popover')
            await tab(pg,'plan')
            check((await pg.evaluate(LAYERS))==dict(L2,trail=not tr),'after an edit, changing tab keeps your layers')
            await blur(pg); await pg.keyboard.press('l'); await pg.wait_for_timeout(80); await pg.click('#lp-auto'); await pg.wait_for_timeout(80)
            check((await pg.evaluate(LAYERS))==L1,'"Let each tab choose" gives the tab\'s set back')
            await pg.keyboard.press('Escape')

            # ---- How it works: one panel per pipeline tab, its math as MathML
            area('How it works')
            for t in ['sen','loc','per','mis','plan','ctl','veh']:
                await tab(pg,t); await pg.click('#pane details[data-how] > summary'); await pg.wait_for_timeout(60)
                r=await pg.evaluate('''() => { const d=document.querySelector('#pane details[data-how]'), c=d.querySelector('.how-body').cloneNode(true), n=c.querySelectorAll('math').length;
                  c.querySelectorAll('math').forEach(m=>m.remove()); const txt=c.textContent; return {open:d.open, n, len:txt.length, raw:d.innerHTML.includes('TEX`'),
                  dollar:(txt.match(/\\$[^$]+\\$/)||[''])[0].slice(0,40), tex:(txt.match(/\\\\(frac|sigma|begin|mathrm|text|theta|omega)\\b/)||[''])[0]}; }''')
                check(r['open'] and r['n']>0 and r['len']>200 and not r['raw'] and not r['dollar'] and not r['tex'],
                      f"{t}: {r['n']} math elements, no TeX left ({r['dollar'] or r['tex'] or 'clean'})")

            # ---- What's new
            area("What's new")
            await pg.click('#appver'); await pg.wait_for_timeout(200)
            w=await pg.evaluate('''() => { const p=document.querySelector('#verpop'); return {shown:!p.hidden, head:(p.querySelector('.wn-head b')||{}).textContent,
              items:p.querySelectorAll(':scope > .wn-txt li, :scope > .wn-txt p').length, label:document.querySelector('#appver').textContent}; }''')
            check(w['label'].startswith(f'v{VERSION} ') and w['shown'] and w['head']==f"What's new in v{VERSION}",f'the version label opens What\'s new for v{VERSION}: {w["head"]!r}')
            check(w['items']>=1,f'the current release has entries ({w["items"]})')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(80)
            check(await pg.is_hidden('#verpop'),'Escape closes it')

            # ---- URL state: level, seed, a setting and the mode round-trip through the hash
            area('URL state')
            await pg.evaluate('window.__nav.switchLevel(2)'); await pg.wait_for_timeout(150)
            await pg.evaluate("window.__nav.setParam('seed',11)")
            await tab(pg,'loc'); await pg.click('#pane [data-k="loc"] button[data-v="pf"]'); await pg.wait_for_timeout(100)
            await pg.click('#mode-an'); await pg.wait_for_timeout(500)
            h=await pg.evaluate('location.hash')
            check(all(x in h[1:].split('&') for x in ['l=L3','seed=11','loc=pf','mode=an']),'the hash says the level, seed, setting and mode: '+h)
            p2=await ctx.new_page(); watch(p2); await p2.goto(page_url(h)); await p2.wait_for_timeout(900)
            r=await p2.evaluate("[window.__nav.LV.id, window.__nav.P.seed, window.__nav.P.loc, window.__an.AN.mode, document.querySelector('.layout').dataset.mode, location.hash]")
            check(r[:4]==['L3',11,'pf','an'],f'a fresh page with that hash restores them: {r[:5]}')
            check(r[5]==h,'and keeps the same hash')
            await p2.goto(page_url('#l=L1&seed=7&t=4')); await p2.wait_for_timeout(1500)
            s=await p2.evaluate(TL)
            check(s['state']=='replay' and s['shown']==4.0 and s['badge'],f'a link with t=4 shows that moment paused: "{s["txt"]}"')
            await p2.close()

            # ---- dark mode: another background, and readable text
            area('Dark mode')
            SELS=['body','.brand h1','#appver','#status .kv span','#status .kv b','#tab-loc','#pane .note','#pane .lbl','#scrubt','#tg-runs']
            light=await pg.evaluate("getComputedStyle(document.body).backgroundColor")
            lc=await pg.evaluate(CONTRAST,SELS)
            dctx=await b.new_context(viewport={'width':1440,'height':900},color_scheme='dark'); dp=await dctx.new_page(); watch(dp)
            await dp.goto(page_url()); await dp.wait_for_timeout(700); await dp.click('#tab-loc'); await dp.wait_for_timeout(80)
            dark=await dp.evaluate("getComputedStyle(document.body).backgroundColor")
            dc=await dp.evaluate(CONTRAST,SELS)
            lum=lambda s: sum(int(x) for x in re.findall(r'\d+',s)[:3])
            check(dark!=light and lum(dark)<lum(light),f'the body background changes ({light} → {dark})')
            for (s,c) in dc: check(c is not None and c>=4.5,f'dark: {s} contrast {c}')
            for (s,c) in lc: check(c is not None and c>=4.5,f'light: {s} contrast {c}')
            await dctx.close()
        except Exception as e:  # a step that cannot run (an element gone, a timeout) fails its area; the areas after it do not run
            check(False,'stopped: '+(str(e).strip().split(chr(10))[0])[:160])
        area('')
        for l in SUMMARY: print(l)
        print(f'uitest: {time.time()-t_start:.0f} s')
        print('FAILS',FAILS)
        print('ERRORS',[e for e in errs][:10])
        await b.close()
    return 1 if FAILS or errs else 0
sys.exit(asyncio.run(main()))
