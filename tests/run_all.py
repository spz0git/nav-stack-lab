#!/usr/bin/env python3
# Runs the test gate: test.py, p5test.py, tles.py, chtest.py, dyntest.py, extest.py, trtest.py, lvtest.py (about seven minutes), from any directory.
#   python3 tests/run_all.py            the eight gate tests
#   python3 tests/run_all.py p5test     a subset, by name
#   python3 tests/run_all.py --quick    passes --quick to dyntest.py
# Each script's output is shown as it runs; at the end a table says which passed. A test passes when it exits 0 and
# prints its "no errors" marker (ERRORS [] etc.). Exit status 1 if any failed.
import os,re,subprocess,sys,time
HERE=os.path.dirname(os.path.abspath(__file__))
GATE=[('test.py',[r'ERRORS: \[\]']),('p5test.py',[r'ERRORS \[\]']),('tles.py',[r'ERR \[\]']),('chtest.py',[r'ERRORS \[\]']),('dyntest.py',[r'ERRORS: \[\]',r'FAILS: \[\]']),('extest.py',[r'ERRORS: \[\]',r'FAILS: \[\]']),('trtest.py',[r'ERRORS \[\]']),('lvtest.py',[r'ERRORS \[\]'])]
args=[a for a in sys.argv[1:] if not a.startswith('--')]; flags=[a for a in sys.argv[1:] if a.startswith('--')]
todo=[g for g in GATE if not args or g[0] in args or g[0][:-3] in args]
if args and not todo: sys.exit('no such test; gate tests: '+', '.join(n for n,_ in GATE))
if not os.path.exists(os.path.join(HERE,'..','dist','nav-stack-lab.html')) and not os.environ.get('NAV_LAB_PAGE'): sys.exit('dist/nav-stack-lab.html is missing: run ./build.sh first')
rows=[]
for name,markers in todo:
    print(f'\n===== {name}',flush=True); t0=time.time(); out=[]
    cmd=[sys.executable,name]+(flags if name=='dyntest.py' else [])
    with subprocess.Popen(cmd,cwd=HERE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True) as pr:
        for line in pr.stdout: print(line,end='',flush=True); out.append(line)
    text=''.join(out); ok=pr.returncode==0 and all(re.search(m,text) for m in markers)
    rows.append((name,ok,time.time()-t0,pr.returncode))
print('\n===== summary')
for name,ok,dt,rc in rows: print(f"{'PASS' if ok else 'FAIL':4s}  {name:12s} {dt:6.0f} s"+('' if rc==0 else f'  (exit {rc})'))
sys.exit(0 if all(ok for _,ok,_,_ in rows) else 1)
