# One-time split of the built page into src/ modules. After this, src/ is the source of truth and build.mjs rebuilds the page.
import os,re
S=open('nav-stack-lab.html').read().split('\n')
def idx(pat,start=0):
    for i in range(start,len(S)):
        if S[i].startswith(pat):return i
    raise SystemExit('missing '+pat)
# ---- html + css ----
st0=idx('<style>');st1=idx('</style>');sc0=idx('<script>');sc1=idx('</script>',sc0)
css='\n'.join(S[st0+1:st1])
html='\n'.join(S[:st0]+['<style>','/*__CSS__*/','</style>']+S[st1+1:sc0]+['<script>','/*__JS__*/','</script>']+S[sc1+1:])
os.makedirs('src/core',exist_ok=True);os.makedirs('src/ui',exist_ok=True);os.makedirs('src/analysis',exist_ok=True)
open('src/index.html','w').write(html);open('src/styles.css','w').write(css+'\n')
# ---- js: the IIFE body, split at markers (line prefixes) in order ----
j0=sc0+3  # after "(()=>{" and "'use strict';"
assert S[sc0+1].startswith('(()=>{') and S[sc0+2].startswith("'use strict'")
j1=idx('})();',sc1-5)  # the closing of the IIFE, just before </script>
# find the last '})();' before </script>
for i in range(sc1-1,sc0,-1):
    if S[i].startswith('})();'):j1=i;break
body=S[j0:j1]
def find(pat,after=0):
    for i in range(after,len(body)):
        if body[i].startswith(pat):return i
    raise SystemExit('marker not found: '+pat)
# marker → file; a marker is the first line of a file; the file runs to the next marker
M=[
 ('/* ============================================================','core/constants.js'),      # Constants & helpers (first header)
 ('const Rc=','core/worlds.js'),
 ('const DEFAULTS=','core/params.js'),
 ('let LV=LEVELS[0]','core/state.js'),
 ('function actuate(){','core/vehicle.js'),
 ('function lidar(){','core/sensors.js'),
 ('function initLoc(','core/localization.js'),
 ('const L_FREE=','core/perception.js'),
 ('const NB=[','core/planning.js'),
 ('/* ---------- Reeds–Shepp only','core/planning-car.js'),
 ('/* ---------- path tracking helpers','core/path.js'),
 ('function remaining(){','core/mission.js'),
 ('function goalDist(','core/controllers.js'),
 ('function mpcModel(){','core/mpc.js'),
 ('function builtinCmd(){','core/dispatch.js'),
 ('const DEFAULT_CODE=','core/custom-controller.js'),
 ('const AG_PATH_CTL=','core/agents.js'),
 ('/* ---------- ST graph (telemetry)','ui/st-plot.js'),
 ('function preControl(){','core/step.js'),
 ('function logE(','core/log.js'),
 ('const cv=$(','ui/map.js'),
 ('/* ---------- plot ----------','ui/plot.js'),
 ('/* ---------- status & metrics','ui/status.js'),
 ('const TABS=[','ui/tabs.js'),
 ('const SCHEMA={','ui/schema.js'),
 ('const NOTES={','ui/notes.js'),
 ('function buildLevels(){','ui/panes.js'),
 ('const NOMEN=[','ui/nomenclature.js'),
 ('function symPane(){','ui/panes2.js'),
 ('/* NUM_BEGIN */','analysis/num.js'),
 ('const AN={','analysis/model.js'),
 ('/* ---------- analysis view: rendering','analysis/ui.js'),
 ('/* ---------- guided lessons','analysis/lessons.js'),
 ('/* ---------- transport & tap','ui/transport.js'),
 ('/* ---------- main loop','ui/loop.js'),
 ('/* ---------- boot','ui/boot.js'),
]
starts=[];pos=0
for pat,f in M:
    i=find(pat,pos);starts.append((i,f));pos=i+1
starts.append((len(body),None))
# the comment header that precedes a marker belongs to that file: pull back over leading comment lines
def back(i):
    while i>0 and (body[i-1].startswith('/*')or body[i-1].startswith('   ')or body[i-1].startswith('// ----')or body[i-1].strip()==''):i-=1
    return i
manifest=[]
for n in range(len(starts)-1):
    a,f=starts[n];b=starts[n+1][0]
    a2=back(a) if n>0 else a
    # don't steal lines already given to the previous file
    if n>0 and a2<starts[n-1][0]+1:a2=a
    starts[n]=(a2,f)
for n in range(len(starts)-1):
    a,f=starts[n];b=starts[n+1][0]
    txt='\n'.join(body[a:b]).rstrip('\n')+'\n'
    open('src/'+f,'w').write(txt);manifest.append(f)
open('src/manifest.json','w').write('[\n'+',\n'.join('  "%s"'%f for f in manifest)+'\n]\n')
print('wrote',len(manifest),'files')
for f in manifest:print('  %-28s %5d lines'%(f,open('src/'+f).read().count('\n')))
