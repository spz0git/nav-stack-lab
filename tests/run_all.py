#!/usr/bin/env python3
# Runs the browser tests, from any directory. A test passes when it exits 0 and prints its "no errors" marker
# (ERRORS [] etc.); at the end a table says which passed. Exit status 1 if any failed.
#   python3 tests/run_all.py --changed        the tests this change needs (below); what a PR runs before its merge
#   python3 tests/run_all.py --changed BASE   the same, against BASE instead of origin/main
#   python3 tests/run_all.py --changed --list which tests, and the files that call for each, without running them
#   python3 tests/run_all.py                  all twelve (about twelve minutes): nightly in CI, and for a change to the
#                                             build or the test harness
#   python3 tests/run_all.py p5test smoke     a subset, by name
#   python3 tests/run_all.py --quick          passes --quick to dyntest.py
#   NAV_LAB_SHOTS=DIR python3 tests/run_all.py   screenshots of each failing test's pages in DIR/<test> (tests/_browser.py);
#                                             a passing test's folder is removed (the nightly uploads DIR on failure)
# --changed reads `git diff --name-only BASE...HEAD` plus uncommitted changes. Any change to the page (dist/ differs)
# runs smoke.py (about 40 s: every tab on every level at three widths, Analyze, Learn, a short run); SCOPE then adds
# the tests that cover the files changed. A change outside the page (documentation, CI) runs nothing. The lint, the
# format check, the build check and the Node tests (golden L1–L5 numbers) run in CI on every push.
import os,re,shutil,subprocess,sys,time
HERE=os.path.dirname(os.path.abspath(__file__))
GATE=[('smoke.py',[r'ERRORS \[\]']),('test.py',[r'ERRORS: \[\]']),('p5test.py',[r'ERRORS \[\]']),('tles.py',[r'ERR \[\]']),('chtest.py',[r'ERRORS \[\]']),('dyntest.py',[r'ERRORS: \[\]',r'FAILS: \[\]']),('extest.py',[r'ERRORS: \[\]',r'FAILS: \[\]']),('trtest.py',[r'ERRORS \[\]']),('lvtest.py',[r'ERRORS \[\]']),('sntest.py',[r'ERRORS \[\]',r'FAILS \[\]']),('saftest.py',[r'ERRORS \[\]',r'FAILS \[\]']),('uitest.py',[r'ERRORS \[\]',r'FAILS \[\]'])]
# (a changed path, the tests it needs); 'ALL' for what every test depends on. The core runs under every test, so any
# core change runs the L1–L5 regression and every Try button; the rest follow the subsystem.
SCOPE=[
    (r'^(build\.(mjs|sh)|src/(manifest\.json|index\.html|worker/)|tools/(tex|changelog)\.mjs|tools/vendor/|tests/(_browser|run_all)\.py)','ALL'),  # package.json is not here: the build needs only Node, so its version bump or a dev tool changes nothing in the page
    (r'^src/core/',['test.py','p5test.py']),
    (r'^src/core/(vehicle|controllers|mpc|dispatch|planning-car)\.js|^src/analysis/(num|model|speed|ui)\.js',['dyntest.py']),
    (r'^src/(core/(slots|custom-controller|examples-data)\.js|examples/)|^src/ui/source\.js|^tools/code\.mjs',['extest.py']),
    (r'^src/(core/(nn|nn-train|dataset|models-data|agents|predict)\.js|models/)|^src/ui/train\.js',['trtest.py']),
    (r'^src/core/(levels|worldgen|worlds)\.js|^src/ui/(levelmenu|maptools|urlstate)\.js',['lvtest.py']),
    (r'^src/core/(sensors|health|localization|fidelity|step|agents)\.js|^src/ui/health\.js',['sntest.py']),
    (r'^src/core/(safety|search|health|config|learnmon|radar|oddmon|argument)\.js|^src/ui/(safety|status|argument)\.js|^tools/(search|ood-ref|argument)\.mjs',['saftest.py']),
    (r'^docs/lessons/|^src/analysis/(lessons|lessons2|lessons-data|glossary)\.js|^src/ui/(learn|experiments)\.js|^tools/lessons\.mjs',['tles.py','p5test.py']),
    (r'^docs/notes/|^src/ui/chapters\.js|^tools/notes\.mjs',['chtest.py']),
    (r'^src/ui/|^src/styles\.css|^src/core/record\.js',['uitest.py']),  # the workspace: replay, runs, palette, layers, the hash, …
    (r'^tests/(\w+\.py)$',None),  # a changed test runs itself
]
def changed_scope(base):
    git=lambda *a: subprocess.run(['git',*a],cwd=HERE,capture_output=True,text=True).stdout.split()
    files=sorted(set(git('diff','--name-only',f'{base}...HEAD')+git('diff','--name-only','HEAD')))
    if not files: return [],{}
    why={}
    if any(f.startswith('dist/') for f in files): why['smoke.py']=['the page changed']
    for f in files:
        for pat,tests in SCOPE:
            m=re.search(pat,f)
            if not m: continue
            if tests=='ALL': return [n for n,_ in GATE],{'all':[f]}
            for t in tests or [m.group(1)]: why.setdefault(t,[]).append(f)
    return [n for n,_ in GATE if n in why],why
args=[a for a in sys.argv[1:] if not a.startswith('--')]; flags=[a for a in sys.argv[1:] if a.startswith('--') and a not in ('--changed','--list')]
if '--changed' in sys.argv:
    base=args[0] if args else 'origin/main'
    names,why=changed_scope(base)
    for t,fs in why.items(): print(f'{t}: {", ".join(fs[:4])}{" …" if len(fs)>4 else ""}')
    if not names: sys.exit(f'Nothing to run: no change to the page or its tests since {base}.')
    if '--list' in sys.argv: print('would run:',' '.join(names)); sys.exit(0)
    args=names
todo=[g for g in GATE if not args or g[0] in args or g[0][:-3] in args]
if args and not todo: sys.exit('no such test; gate tests: '+', '.join(n for n,_ in GATE))
if not os.path.exists(os.path.join(HERE,'..','dist','nav-stack-lab.html')) and not os.environ.get('NAV_LAB_PAGE'): sys.exit('dist/nav-stack-lab.html is missing: run ./build.sh first')
rows=[]; SHOTS=os.environ.get('NAV_LAB_SHOTS')
for name,markers in todo:
    print(f'\n===== {name}',flush=True); t0=time.time(); out=[]
    cmd=[sys.executable,name]+(flags if name=='dyntest.py' else [])
    env=dict(os.environ,NAV_LAB_SHOTS=os.path.join(os.path.abspath(SHOTS),name[:-3])) if SHOTS else None
    with subprocess.Popen(cmd,cwd=HERE,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True) as pr:
        for line in pr.stdout: print(line,end='',flush=True); out.append(line)
    text=''.join(out); ok=pr.returncode==0 and all(re.search(m,text) for m in markers)
    if ok and env: shutil.rmtree(env['NAV_LAB_SHOTS'],ignore_errors=True)
    rows.append((name,ok,time.time()-t0,pr.returncode))
print('\n===== summary')
for name,ok,dt,rc in rows: print(f"{'PASS' if ok else 'FAIL':4s}  {name:12s} {dt:6.0f} s"+('' if rc==0 else f'  (exit {rc})'))
sys.exit(0 if all(ok for _,ok,_,_ in rows) else 1)
