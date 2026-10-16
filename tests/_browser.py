# Shared by every test: where the built page is and how to launch the browser, so the scripts run from any directory
# and on any machine with Playwright installed.
#   NAV_LAB_CHROMIUM=/path/to/chrome   use that binary instead of Playwright's own Chromium (`playwright install chromium`)
#   NAV_LAB_PAGE=/path/to/page.html    test another build than ../dist/nav-stack-lab.html
import os
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
    return await p.chromium.launch(**kw)
