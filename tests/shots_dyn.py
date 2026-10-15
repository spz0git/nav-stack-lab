# Screenshots and UI checks for the car with tyre slip (Vehicle → Car, dynamic): the Vehicle tab with the presets and
# the info line, the sideslip arrow on the map, plots of a_y against μg and of the yaw rate against v tanδ / L, and the
# Control health light, at 1440×900 and 390×844, light and dark.
# Usage (from tests/, after ./build.sh): python3 shots_dyn.py <out-dir>            the Simulate set (step B)
#                                          python3 shots_dyn.py --analyze <out-dir>  Analyze with the slippery car at 2 m/s (step C)
#                                          python3 shots_dyn.py --learn <out-dir>    the lesson "Running out of grip" after its third Try (step D)
import asyncio, os, sys
from playwright.async_api import async_playwright
SIZES={'desk':(1440,900),'phone':(390,844)}
# L1 open floor with the slippery car at 1.5 m/s and the curve cap lifted, so the car runs out of grip in the turns
SETUP=r'''
async () => {
  const N=window.__nav; N.loadLevel(0);
  N.setParam('veh','dyn',false); for(const [k,v] of Object.entries({mass:10,Iz:0.9,lf:0.27,Cf:40,Cr:90,mu:0.25})) N.setParam(k,v,false);
  N.setParam('vmax',2,false); N.setParam('vcruise',1.5,false); N.setParam('alat',3,false);
  document.querySelector('#run').click(); document.querySelector('#run').click();
  let ayMax=0,amber=null;
  for(let i=0;i<260;i++){await N.advance(1);const q=N.dynSlip(N.S.robot);ayMax=Math.max(ayMax,Math.abs(q.ay));
    const h=document.querySelector('#health');}
  return {t:N.S.t, ayMax, beta:N.dynSlip(N.S.robot).beta*180/Math.PI, veh:N.P.veh, model:N.P.model, carPhys:N.P.carPhys};
}'''
async def shot(b,out,size,dark,checks):
    w,h=SIZES[size]
    ctx=await b.new_context(viewport={'width':w,'height':h},device_scale_factor=2 if size=='phone' else 1,color_scheme='dark' if dark else 'light',is_mobile=size=='phone',has_touch=size=='phone')
    pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file://'+os.path.abspath('wrapped.html')); await pg.wait_for_timeout(700)
    r=await pg.evaluate(SETUP)
    await pg.evaluate("()=>{const P=window.__plots;P.addPane(['ay','mug']);P.addPane(['yawr','yawk','beta']);}")
    await pg.wait_for_timeout(300)
    if size=='desk':
        await pg.click('#tab-veh'); await pg.wait_for_timeout(200)
        await pg.evaluate("document.querySelector('#pane .btn, #pane [data-k=veh]').scrollIntoView({block:'start'})")
    await pg.wait_for_timeout(300)
    fn=f"{size}-dyn{'-dark' if dark else ''}.png";await pg.screenshot(path=os.path.join(out,fn))
    if size=='desk' and not dark:
        info=await pg.evaluate("[...document.querySelectorAll('#pane p.note')].map(p=>p.textContent).filter(t=>/K_us/.test(t))")
        rows=await pg.evaluate("[...document.querySelectorAll('#pane .seg[data-k=veh] button')].map(b=>b.textContent+(b.getAttribute('aria-pressed')==='true'?' *':''))")
        tyres=await pg.evaluate("[...document.querySelectorAll('#pane .seg:not([data-k]) button')].map(b=>b.textContent+(b.getAttribute('aria-pressed')==='true'?' *':''))")
        health=await pg.evaluate("[...document.querySelectorAll('#health [data-sys], #health button')].map(e=>e.textContent.trim()).filter(Boolean)")
        vals=await pg.evaluate("()=>{const W=window.__plots;return ['beta','yawr','yawk','ay','mug','af','ar'].map(k=>[k,W.sigAt(k,window.__nav.S.t)])}")
        layers=await pg.evaluate("window.__nav.LAYERS.slip")
        checks.update(run=r,rows=rows,tyres=tyres,info=info,health=health,signals=vals,slipLayer=layers)
        # the Changed list and a link reload keep the choice
        url=await pg.evaluate("window.__nav.configURL()")
        checks['link_has']=[k for k in ['model=car','carPhys=dyn','Cf=40','mu=0.25'] if k in url]
    checks.setdefault('errors',[]).extend(errs)
    await ctx.close()
async def analyze(b,out,size,dark,checks):
    w,h=SIZES[size]
    ctx=await b.new_context(viewport={'width':w,'height':h},device_scale_factor=2 if size=='phone' else 1,color_scheme='dark' if dark else 'light',is_mobile=size=='phone',has_touch=size=='phone')
    pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file://'+os.path.abspath('wrapped.html')); await pg.wait_for_timeout(700)
    await pg.evaluate("()=>{const N=window.__nav;N.loadLevel(0);N.setParam('veh','dyn',false);for(const [k,v] of Object.entries({Cf:40,Cr:90,mu:0.25,vmax:4,vcruise:2}))N.setParam(k,v,false);window.__an.setMode('an');}")
    await pg.wait_for_timeout(500)
    await pg.screenshot(path=os.path.join(out,f"{size}-dyn-an{'-dark' if dark else ''}.png"))
    if size=='desk' and not dark:
        await pg.evaluate("()=>{const d=document.querySelector('#an-adv');if(d)d.open=true;}"); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelector('#an-tf').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=os.path.join(out,'desk-dyn-an-tf.png'))
        checks['story']=await pg.evaluate(r"document.querySelector('#an-story').textContent.match(/The vehicle[^]*?μg = [0-9.]+ m\/s²/)?.[0]")
        checks['tf']=await pg.evaluate("document.querySelector('#an-tf').textContent.slice(0,400)")
        checks['op']=await pg.evaluate("document.querySelector('#an-op').textContent")
    checks.setdefault('errors',[]).extend(errs)
    await ctx.close()
async def learn(b,out,size,dark,checks):
    w,h=SIZES[size]
    ctx=await b.new_context(viewport={'width':w,'height':h},device_scale_factor=2 if size=='phone' else 1,color_scheme='dark' if dark else 'light',is_mobile=size=='phone',has_touch=size=='phone')
    pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file://'+os.path.abspath('wrapped.html')); await pg.wait_for_timeout(700)
    lid=await pg.evaluate("window.__an.LESSON_GROUPS().find(g=>g.id==='ctl').items.findIndex(L=>L.t==='Running out of grip')")
    await pg.click('#tab-learn'); await pg.evaluate(f"window.__an.openLesson('ctl:{lid}')"); await pg.wait_for_timeout(150)
    # press the third Try (cap above the grip), pause in the same task, then run a fixed 26 s: the frame just after the car leaves the path
    await pg.evaluate(f"async()=>{{await document.querySelector('button[data-try=\"ctl:{lid}:2\"]').onclick();document.querySelector('#run').click();await window.__nav.advance(520)}}")
    await pg.wait_for_timeout(600); await pg.evaluate("window.scrollTo(0,0)")
    await pg.screenshot(path=os.path.join(out,f"{size}-dyn-learn{'-dark' if dark else ''}.png"))
    if size=='desk' and not dark:
        # the lesson-to-lesson links: Gain scheduling breaks above v_ch ↔ Speed changes the plant
        ln=await pg.evaluate("""async()=>{const A=window.__an,G=A.LESSON_GROUPS().find(g=>g.id==='ctl'),i=G.items.findIndex(L=>L.t==='Gain scheduling breaks above v_ch'),out=[];
          const j=G.items.findIndex(L=>L.t==='Speed changes the plant: gain scheduling');
          for(const [from,title] of [[i,'Speed changes the plant: gain scheduling'],[j,'Gain scheduling breaks above v_ch']]){A.openLesson('ctl:'+from);await new Promise(r=>setTimeout(r,100));
            const a=document.querySelector(`#learnview details.lesson[data-l="ctl:${from}"] a.lsref`)||document.querySelector('#learnview a.lsref');if(!a){out.push('no link in '+from);continue;}a.click();await new Promise(r=>setTimeout(r,100));
            out.push(G.items[+A.lessonOpen.split(':')[1]].t===title?'ok':'wrong: '+A.lessonOpen);}
          return out;}""")
        checks['lesson links']=ln
    checks.setdefault('errors',[]).extend(errs)
    await ctx.close()
async def main():
    an='--analyze' in sys.argv; le='--learn' in sys.argv; args=[a for a in sys.argv[1:] if a not in('--analyze','--learn')]
    out=args[0]; os.makedirs(out,exist_ok=True); checks={}
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        for size in SIZES:
            for dark in (False,True): await (analyze if an else learn if le else shot)(b,out,size,dark,checks)
        await b.close()
    for k,v in checks.items(): print(k,':',v)
asyncio.run(main())
