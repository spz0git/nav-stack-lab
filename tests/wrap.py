# Wraps the built artifact in a full HTML document for the headless tests (the artifact host adds this skeleton when published).
import os
here=os.path.dirname(os.path.abspath(__file__))
s=open(os.path.join(here,'..','dist','nav-stack-lab.html')).read()
open(os.path.join(here,'wrapped.html'),'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+s+'</body></html>')
