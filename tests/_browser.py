# Shared by every test: where the built page is and how to launch the browser, so the scripts run from any directory
# and on any machine with Playwright installed.
#   NAV_LAB_CHROMIUM=/path/to/chrome   use that binary instead of Playwright's own Chromium (`playwright install chromium`)
#   NAV_LAB_PAGE=/path/to/page.html    test another build than ../dist/nav-stack-lab.html
#   NAV_LAB_SHOTS=/path/to/dir         screenshots for a failure report: each page at its first page error and when the
#                                      test closes it (CI uploads the folder when a run fails; run_all.py keeps only
#                                      the failing tests' shots)
import os, sys
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.dirname(HERE)
PAGE=os.environ.get('NAV_LAB_PAGE') or os.path.join(ROOT,'dist','nav-stack-lab.html')
PAGE_URL='file://'+os.path.abspath(PAGE)
def page_url(hash=''):
    """The page as a file: URL, with an optional '#…' fragment."""
    return PAGE_URL+hash
async def launch(p,**kw):
    """p.chromium.launch(...) with the NAV_LAB_CHROMIUM override; kw is passed through (headless, args, …)."""
    exe=os.environ.get('NAV_LAB_CHROMIUM')
    if exe: kw['executable_path']=exe
    b=await p.chromium.launch(**kw)
    if os.environ.get('NAV_LAB_SHOTS'): _shoot_pages(b,os.environ['NAV_LAB_SHOTS'])
    return b
def _shoot_pages(b,out):
    """Wraps b so that every page it opens is photographed into out at its first page error and before it closes."""
    os.makedirs(out,exist_ok=True)
    name=os.path.splitext(os.path.basename(sys.argv[0]))[0] or 'test'; n=[0]; pages=[]
    async def shot(pg,why):
        n[0]+=1
        try: await pg.screenshot(path=os.path.join(out,f'{name}-{n[0]:02d}-{why}.png'))
        except Exception: pass  # a crashed or closing page: no picture, never a second failure
    def track(pg):
        pages.append(pg); seen=[False]; close=pg.close
        async def on_error(e):
            if not seen[0]: seen[0]=True; await shot(pg,'pageerror')
        async def close_with_shot(*a,**k):
            if not pg.is_closed(): await shot(pg,'end')
            return await close(*a,**k)
        pg.on('pageerror',on_error); pg.close=close_with_shot
    new_page,new_context,close=b.new_page,b.new_context,b.close
    async def new_page_(*a,**k):
        pg=await new_page(*a,**k); track(pg); return pg
    async def new_context_(*a,**k):
        c=await new_context(*a,**k); c.on('page',track); return c
    async def close_(*a,**k):
        for pg in pages:
            if not pg.is_closed(): await shot(pg,'end')
        return await close(*a,**k)
    b.new_page,b.new_context,b.close=new_page_,new_context_,close_
