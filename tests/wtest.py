import asyncio,os,json
from playwright.async_api import async_playwright
JS=r'''async ({level,overrides,seed,secs})=>{const src=document.getElementById('core-worker-src').textContent;
 const w=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));
 return await new Promise((res,rej)=>{w.onmessage=e=>{if(e.data.done){w.terminate();res(e.data);}};w.onerror=e=>{rej(e.message);};w.postMessage({cmd:'run',id:1,level,overrides,seed,secs});});}'''
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        pg=await b.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://'+os.path.abspath('../dist/nav-stack-lab.html')); await pg.wait_for_timeout(500)
        for lvl,ov,secs in [(0,{},90),(4,{},250),(5,{},300),(4,{'ctl':'mpc','mpcLag':True},250)]:
            r=await pg.evaluate(JS,{'level':lvl,'overrides':ov,'seed':7,'secs':secs})
            print(lvl+1,ov,{k:v for k,v in r.get('summary',{}).items() if k!='log'},r.get('error'),r['ms'],'ms')
        # the page itself still works
        r=await pg.evaluate("async()=>{const N=window.__nav;N.loadLevel(0);document.querySelector('#run').click();document.querySelector('#run').click();await N.advance(1800);return [N.S.fsm.state,N.S.t]}")
        print('page L1',r,'ERR',errs); await b.close()
asyncio.run(main())
