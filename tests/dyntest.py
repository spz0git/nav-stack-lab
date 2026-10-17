import asyncio, math, os, sys
from playwright.async_api import async_playwright
from _browser import launch, page_url
# The car with tyre slip (P.carPhys 'dyn', core/vehicle.js), checked against what chapter 1 §4–5 predicts:
#  1. stiff tyres: a whole L6 mission's true path matches the kinematic car (max gap ≲ 1 cm)
#  2. steady circles: r/δ = v / (L + K_us v²) within 2 % (forward; reverse against the linear model with v_x < 0)
#  3. step steer above v_ch on the slippery preset: the yaw-rate overshoot and peak time of the linear model (ζ < 1)
#  4. missions: L6 with both presets (low speed, reverse legs) completes without collisions or NaN
#  7. the MPC with the tyre model (P.mpcDyn, core/mpc.js): with stiff tyres it drives the kinematic MPC's line on L7;
#     on the moose test the kinematic MPC hits the box and the tyre model passes; Analyze with its v_y and r gains
#     against the simulator (injection, step), the Nyquist count, and the worker core
# The L1–L5 regression (test.py) is the check that the default car and unicycle did not change.
PRESETS={'grippy':{'mass':10,'Iz':0.9,'lf':0.27,'Cf':500,'Cr':700,'mu':0.9},
         'slippery':{'mass':10,'Iz':0.9,'lf':0.27,'Cf':40,'Cr':90,'mu':0.25}}
G=9.81

def lin(p,L,v):
    """Linear bicycle model at forward speed v (sign-aware slip angles, as in vehicle.js): A, B for [v_y, r]."""
    m,Iz,lf,Cf,Cr=p['mass'],p['Iz'],p['lf'],p['Cf'],p['Cr'];lr=L-lf;sg=1 if v>0 else -1
    # α_f = sg(δ − (v_y + l_f r)/v), α_r = −sg (v_y − l_r r)/v
    dfa=[-sg/v,-sg*lf/v];dra=[-sg/v,sg*lr/v]
    A=[[(Cf*dfa[0]+Cr*dra[0])/m,(Cf*dfa[1]+Cr*dra[1])/m-v],[(lf*Cf*dfa[0]-lr*Cr*dra[0])/Iz,(lf*Cf*dfa[1]-lr*Cr*dra[1])/Iz]]
    B=[sg*Cf/m,sg*lf*Cf/Iz]
    return A,B

def kus(p,L):
    lr=L-p['lf'];return p['mass']/L*(lr/p['Cf']-p['lf']/p['Cr'])

def eig(A):
    tr=A[0][0]+A[1][1];det=A[0][0]*A[1][1]-A[0][1]*A[1][0];wn=math.sqrt(det) if det>0 else float('nan')
    return tr,det,wn,-tr/2/wn

def simlin(A,B,ds,dt,n=500):
    """Exact-enough response of the linear model to a piecewise-constant δ per tick (RK4, n steps per tick)."""
    x=[0.0,0.0];out=[];h=dt/n
    f=lambda x,d:[A[0][0]*x[0]+A[0][1]*x[1]+B[0]*d,A[1][0]*x[0]+A[1][1]*x[1]+B[1]*d]
    for d in ds:
        for _ in range(n):
            k1=f(x,d);k2=f([x[i]+h/2*k1[i] for i in range(2)],d);k3=f([x[i]+h/2*k2[i] for i in range(2)],d);k4=f([x[i]+h*k3[i] for i in range(2)],d)
            x=[x[i]+h/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]) for i in range(2)]
        out.append(x[1])
    return out

MISSION=r'''
async ({lvl, set, secs}) => {
  const N=window.__nav; N.loadLevel(lvl); for(const [k,v] of Object.entries(set)) N.setParam(k,v,false);
  document.querySelector('#run').click(); document.querySelector('#run').click();
  const S=N.S, path=[], cmds=[];let nan=false,maxBeta=0,maxAy=0,maxVy=0;
  for(let i=0;i<Math.round(secs/0.05);i++){cmds.push({...S.cmd});await N.advance(1);const r=S.robot;path.push([r.x,r.y,r.th]);
    if(![r.x,r.y,r.th,r.vy,r.r].every(Number.isFinite))nan=true;
    if(N.P.carPhys==='dyn'){const q=N.dynSlip(r);maxBeta=Math.max(maxBeta,Math.abs(q.beta));maxAy=Math.max(maxAy,Math.abs(q.ay));maxVy=Math.max(maxVy,Math.abs(r.vy-(N.P.wheelbase-N.P.lf)*r.r));}
    if(S.fsm.state==='DONE')break;}
  return {path,cmds,t:+S.t.toFixed(2),state:S.fsm.state,done:N.WPS.filter(w=>w.done&&!w.skipped).length+'/'+N.WPS.length,coll:S.coll,ped:S.collPed,nan,
    maxBeta:+(maxBeta*180/Math.PI).toFixed(2),maxAy:+maxAy.toFixed(2),maxSlideRear:+maxVy.toFixed(4),
    rev:S.log.filter(l=>/everse|cusp|Cusp/.test(l.msg)).length};
}'''
# Drive the actuator alone (no mission, no obstacles) with a fixed command: returns per-tick v, δ, r
OPEN=r'''
async ({set, v, steps}) => {
  const N=window.__nav; N.loadLevel(5); for(const [k,val] of Object.entries(set)) N.setParam(k,val,false);
  const S=N.S; S.shapes=[]; S.peds=[]; const r=S.robot; r.x=0; r.y=0; r.th=0; r.v=v; r.d=0; r.vy=0; r.r=0;
  const out=[];
  for(const [n,steer] of steps){S.cmd={v,steer,w:0};S.cmdQ=[];for(let i=0;i<n;i++){N.actuate();out.push([r.v,r.d,r.r,r.vy]);}}
  return out;
}'''

# Replay a recorded command sequence through the actuator alone (same start, obstacles and people removed)
REPLAY=r'''
async ({set, cmds}) => {
  const N=window.__nav; N.loadLevel(5); for(const [k,v] of Object.entries(set)) N.setParam(k,v,false);
  const S=N.S; S.shapes=[]; S.peds=[]; const r=S.robot, path=[];
  for(const c of cmds){S.cmd=c;S.cmdQ=[];N.actuate();path.push([r.x,r.y,r.th]);}
  return path;
}'''

async def main():
    fails=[]
    async with async_playwright() as p:
        b=await launch(p)
        pg=await b.new_page(viewport={'width':1280,'height':900})
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto(page_url())
        await pg.wait_for_timeout(800)
        L=await pg.evaluate('window.__nav.P.wheelbase')
        await pg.evaluate("window.__nav.loadLevel(5)");L=await pg.evaluate('window.__nav.P.wheelbase')

        print('== presets (L = %.2f m)'%L)
        for name,pr in PRESETS.items():
            K=kus(pr,L);vch=math.sqrt(L/K) if K>0 else None
            info=await pg.evaluate("(s)=>{const N=window.__nav;N.loadLevel(5);for(const [k,v] of Object.entries(s))N.setParam(k,v,false);return N.dynInfo();}",{**pr,'carPhys':'dyn'})
            print(f"  {name}: K_us {K:.4f} rad/(m/s²) = {math.degrees(K):.2f}°/(m/s²), v_ch {vch:.2f} m/s, μg {pr['mu']*G:.2f} m/s²  (page: K {info['K']:.4f}, v_ch {info['vch']:.2f})")
            if abs(info['K']-K)>1e-9: fails.append(f'{name}: dynInfo K differs')
            for v in [0.5,0.8,1,1.5,2,3,4]:
                tr,det,wn,z=eig(lin(pr,L,v)[0]);disc=tr*tr/4-det
                ev=f"{tr/2:.2f} ± {math.sqrt(-disc):.2f}j" if disc<0 else f"{tr/2+math.sqrt(disc):.1f}, {tr/2-math.sqrt(disc):.1f}"
                print(f"     v {v}: eigenvalues {ev} 1/s · ω_n {wn:.1f} rad/s · ζ {z:.2f} · r/δ ÷ v/L {L/(L+K*v*v):.3f} · radius at μg {v*v/(pr['mu']*G):.2f} m")

        print('== 1. stiff tyres reproduce the kinematic car (L6, whole mission)')
        kin=await pg.evaluate(MISSION,{'lvl':5,'set':{},'secs':300})
        stiffset={'carPhys':'dyn','Cf':1e6,'Cr':1e6,'mu':1e4}   # μ too: a finite friction limit caps the yaw acceleration the kinematic car takes for free
        print('  kinematic mission',{k:v for k,v in kin.items() if k not in('path','cmds')})
        for name,st in [('kinematic',{}),('stiff dyn',stiffset)]:
            rp=await pg.evaluate(REPLAY,{'set':st,'cmds':kin['cmds']})
            gap=max(math.dist(kin['path'][i][:2],rp[i][:2]) for i in range(len(rp)));gth=max(abs(math.remainder(kin['path'][i][2]-rp[i][2],2*math.pi)) for i in range(len(rp)))
            print(f'  {name:9s} car driven open loop with the mission\'s {len(rp)} commands: max gap {gap*100:.3f} cm, heading {math.degrees(gth):.3f}°')
            if gap>0.01: fails.append(f'{name} replay differs: {gap*100:.2f} cm')
        stiff=await pg.evaluate(MISSION,{'lvl':5,'set':stiffset,'secs':300})
        n=min(len(kin['path']),len(stiff['path']));first=next((i for i in range(n) if math.dist(kin['path'][i][:2],stiff['path'][i][:2])>0.01),None)
        print('  stiff dyn mission (closed loop)',{k:v for k,v in stiff.items() if k not in('path','cmds')},f'first 1 cm gap at {first*0.05 if first is not None else "-"} s')
        if stiff['done']!=kin['done'] or stiff['coll']: fails.append(f"stiff-tyre mission: {stiff['done']}, {stiff['coll']} collisions")
        if '--quick' in sys.argv: print('FAILS:',fails); return
        print('== 2. steady circles: r/δ against v/(L + K_us v²)')
        for name,pr in PRESETS.items():
            K=kus(pr,L)
            for v in [0.5,1,1.5,2,2.5,3,4,-0.35]:
                d=0.03 if name=='slippery' else 0.02
                tr=await pg.evaluate(OPEN,{'set':{**pr,'carPhys':'dyn','vmax':4},'v':v,'steps':[[120,d]]})
                vv,dd,r,vy=tr[-1]
                A,B=lin(pr,L,v);det=A[0][0]*A[1][1]-A[0][1]*A[1][0]
                ss=-(A[1][0]*(-B[0])+A[0][0]*B[1])/det if False else (A[1][0]*B[0]-A[0][0]*B[1])/det   # r/δ = −(A⁻¹B)_r
                pred=v/(L+K*v*v) if v>0 else ss
                err=(r/dd)/pred-1;ay=abs(v*r)
                print(f"  {name:8s} v {v:5.2f}: δ {math.degrees(dd):.2f}°, r/δ {r/dd:.4f} vs {pred:.4f} ({'formula' if v>0 else 'linear model, reverse'}) err {err*100:+.2f} %, a_y {ay:.2f} m/s² ({ay/(pr['mu']*G)*100:.0f} % of μg)")
                if abs(err)>0.02: fails.append(f'{name} v {v}: r/δ off by {err*100:.1f} %')
                if v>0 and abs(ss/pred-1)>1e-6: fails.append('linear model and the K_us formula disagree')

        print('== 3. step steer above v_ch on the slippery preset')
        pr=PRESETS['slippery'];vch=math.sqrt(L/kus(pr,L))
        for v in [3.5,4.0]:
            d=0.04
            tr=await pg.evaluate(OPEN,{'set':{**pr,'carPhys':'dyn','vmax':4},'v':v,'steps':[[10,0],[100,d]]})
            ds=[t[1] for t in tr];rs=[t[2] for t in tr]
            A,B=lin(pr,L,v);tr_,det,wn,z=eig(A)
            rl=simlin(A,B,ds,0.05)
            def os_(x):
                fin=x[-1];k=max(range(len(x)),key=lambda i:x[i]);return (x[k]/fin-1)*100,(k-10)*0.05
            om,tm=os_(rs);ol,tl=os_(rl)
            os2=100*math.exp(-math.pi*z/math.sqrt(1-z*z)) if z<1 else 0
            print(f"  v {v} (v_ch {vch:.2f}): ω_n {wn:.2f} rad/s, ζ {z:.2f} (2nd-order overshoot without the zero {os2:.1f} %)")
            print(f"     simulator: overshoot {om:.1f} % at {tm:.2f} s · linear model with the same δ(t): {ol:.1f} % at {tl:.2f} s · steady r {rs[-1]:.4f} vs {rl[-1]:.4f}")
            if abs(om-ol)>max(0.1*abs(ol),0.5) or abs(tm-tl)>0.051 or om<1: fails.append(f'step steer v {v}: overshoot {om:.1f} vs {ol:.1f} %')

        print('== 5. Analyze: the linear model with the tyres against the nonlinear simulator')
        AN_JS=r'''async ({set}) => {const N=window.__nav,A=window.__an;N.loadLevel(0);for(const [k,v] of Object.entries(set))N.setParam(k,v,false);
          A.AN.dirty=true;const R=A.anCompute();A.AN.injAmp='small';await A.runInjection();
          const F=A.AN.meas.freq||[];let dB=0,dph=0;for(const q of F){const m=A.Ljw(R.M,q.w);const a=20*Math.log10(q.mag/Math.hypot(m[0],m[1]));let p=(q.ph-Math.atan2(m[1],m[0]))*180/Math.PI;p=((p+540)%360)-180;dB=Math.max(dB,Math.abs(a));dph=Math.max(dph,Math.abs(p));}
          A.AN.stepKind='offset';A.AN.stepAmp=0.05;A.runStepTest();const sm=A.stepMetrics(A.AN.meas.step.data,'offset');
          const pol=R.olp.filter(p=>Math.hypot(p[0],p[1])>1e-6).map(p=>p[0].toFixed(1)+(Math.abs(p[1])>1e-6?(p[1]>0?'+':'-')+Math.abs(p[1]).toFixed(1)+'j':''));
          return {v0:R.M.v0,dyn:!!R.M.dyn,stable:R.stable,PM:R.F.pm,wc:R.F.wc,zeta:R.zeta,n:F.length,dB,dph,OSlin:R.smOff.overshoot,OSsim:sm.overshoot,TSlin:R.smOff.settle,TSsim:sm.settle,olp:pol};}'''
        for name,pr,ctl,v in [('slippery',PRESETS['slippery'],'pp',1.0),('slippery',PRESETS['slippery'],'pp',2.0),('slippery',PRESETS['slippery'],'rwf',2.0),
                              ('slippery',PRESETS['slippery'],'stanley',2.0),('slippery',PRESETS['slippery'],'pid',1.5),('slippery',PRESETS['slippery'],'mpc',1.5),
                              ('slippery',PRESETS['slippery'],'pp',3.0),('grippy',PRESETS['grippy'],'pp',1.0),('grippy',PRESETS['grippy'],'rwf',2.0)]:
            r=await pg.evaluate(AN_JS,{'set':{'veh':'dyn',**pr,'vmax':4,'vcruise':v,'ctl':ctl}})
            print(f"  {name:8s} {ctl:7s} v {r['v0']:.1f}: {'stable' if r['stable'] else 'UNSTABLE'}, PM {r['PM'] or 0:.0f}°, ω_c {r['wc'] or 0:.2f}, ζ {r['zeta'] or 0:.2f} · injection vs model over {r['n']} freqs: {r['dB']:.2f} dB, {r['dph']:.1f}° · step 5 cm: overshoot {r['OSlin']:.1f} % model / {r['OSsim']:.1f} % sim, settle {r['TSlin']:.2f} / {r['TSsim']:.2f} s · open-loop poles {r['olp']}")
            # a loop with almost no phase margin rings at its crossover, and a lock-in near −1 measures that, not L: reported, not checked
            if not r['dyn'] or r['n']<5 or (r['PM'] or 0)>15 and (r['dB']>0.5 or r['dph']>3): fails.append(f"Analyze {name} {ctl} v {v}: {r['dB']:.2f} dB / {r['dph']:.1f}°")

        # the Nyquist count (Z = N + P, with P the plant's own unstable poles) against the closed-loop eigenvalues
        NYQ_JS=r'''async ({set}) => {const N=window.__nav,A=window.__an;N.loadLevel(0);for(const [k,v] of Object.entries(set))N.setParam(k,v,false);
          A.AN.dirty=true;const R=A.anCompute();return {unst:R.unstableZ,N:R.F.Ncw,P:R.F.P};}'''
        bad=[];n=0;over={'mass':10,'Iz':0.9,'lf':0.27,'Cf':90,'Cr':40,'mu':0.25}   # oversteering: v_crit 3.4 m/s
        for pr in [PRESETS['slippery'],PRESETS['grippy'],over]:
            for ctl in ['pp','rwf','stanley','pid','mpc']:
                for v in [1,2,4]:
                    r=await pg.evaluate(NYQ_JS,{'set':{'veh':'dyn',**pr,'vmax':4,'vcruise':v,'ctl':ctl}});n+=1
                    if r['N']+r['P']!=r['unst']: bad.append((pr['Cf'],ctl,v,r))
        print(f'  Nyquist Z = N + P against the eigenvalues: {n} cases (three tyre sets, one oversteering, five trackers, 1–4 m/s), mismatches {bad}')
        if bad: fails.append('Nyquist count disagrees with the eigenvalues')

        print('== 6. the worker core (Experiments) runs the car with tyre slip as the page does')
        WK=r'''async ({level,overrides,seed,secs})=>{const src=document.getElementById('core-worker-src').textContent;
          const w=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));
          return await new Promise((res,rej)=>{w.onmessage=e=>{if(e.data.done){w.terminate();res(e.data);}};w.onerror=e=>rej(e.message);w.postMessage({cmd:'run',id:1,level,overrides,seed,secs});});}'''
        PG=r'''async ({level,overrides,seed,secs})=>{const N=window.__nav;N.setParam('seed',seed,false);N.loadLevel(level);for(const [k,v] of Object.entries(overrides))N.setParam(k,v,false);
          document.querySelector('#run').click();document.querySelector('#run').click();const S=N.S;for(let i=0;i<Math.round(secs/0.05);i++){await N.advance(1);if(S.fsm.state==='DONE')break;}
          return {t:+S.t.toFixed(2),goalsDone:N.WPS.filter(w=>w.done&&!w.skipped).length,coll:S.coll,cteRMS:S.cteN?+Math.sqrt(S.cteSq/S.cteN).toFixed(4):null,dist:+S.dist.toFixed(2)};}'''
        job={'level':0,'overrides':{'veh':'dyn',**PRESETS['slippery'],'vmax':2,'vcruise':1.5,'alat':1.5},'seed':7,'secs':120}
        wk=await pg.evaluate(WK,job);pgr=await pg.evaluate(PG,job);ws=wk.get('summary',{})
        same={k:(ws.get(k),pgr[k]) for k in ['goalsDone','coll','cteRMS','dist']}   # t differs: the worker checks DONE every 40 ticks
        print('  L1, slippery, 1.5 m/s: worker vs page',same,wk.get('error') or '')
        if wk.get('error') or any(a!=b for a,b in same.values()): fails.append('worker and page differ for the dynamic car')

        print('== 7. MPC with the tyre model in its prediction (L7, the moose test)')
        stiffT={'Cf':1e6,'Cr':1e6,'mu':1e4}
        a=await pg.evaluate(MISSION,{'lvl':6,'set':stiffT,'secs':20});c=await pg.evaluate(MISSION,{'lvl':6,'set':{**stiffT,'mpcDyn':True},'secs':20})
        n=min(len(a['path']),len(c['path']));gap=max(math.dist(a['path'][i][:2],c['path'][i][:2]) for i in range(n))
        print(f"  stiff tyres: kinematic MPC {a['done']} in {a['t']} s, tyre-model MPC {c['done']} in {c['t']} s, max gap {gap*100:.3f} cm")
        if gap>0.01 or a['done']!='1/1' or c['done']!='1/1': fails.append(f'tyre-model MPC with stiff tyres: gap {gap*100:.2f} cm, {a["done"]} / {c["done"]}')
        for name,st,want in [('kinematic MPC',{},'hit'),('tyre-model MPC',{'mpcDyn':True},'pass'),('kinematic car',{'veh':'car'},'pass'),('tyre model, 4 m/s',{'mpcDyn':True,'vcruise':4},'pass')]:
            r=await pg.evaluate(MISSION,{'lvl':6,'set':st,'secs':20})
            print(f'  moose test, {name}:',{k:v for k,v in r.items() if k not in('path','cmds')})
            ok=(r['coll']>0) if want=='hit' else (r['coll']==0 and r['done']=='1/1')
            if not ok or r['nan']: fails.append(f'moose test {name}: {r["done"]}, {r["coll"]} collisions (expected to {want})')
        AN7=r'''async ({lvl,set}) => {const N=window.__nav,A=window.__an;N.loadLevel(lvl);for(const [k,v] of Object.entries(set))N.setParam(k,v,false);
          A.AN.dirty=true;const R=A.anCompute();A.AN.injAmp='small';await A.runInjection();
          const F=A.AN.meas.freq||[];let dB=0,dph=0;for(const q of F){const m=A.Ljw(R.M,q.w);const a=20*Math.log10(q.mag/Math.hypot(m[0],m[1]));let p=(q.ph-Math.atan2(m[1],m[0]))*180/Math.PI;p=((p+540)%360)-180;dB=Math.max(dB,Math.abs(a));dph=Math.max(dph,Math.abs(p));}
          A.AN.stepKind='offset';A.AN.stepAmp=0.05;A.runStepTest();const sm=A.stepMetrics(A.AN.meas.step.data,'offset');
          return {v0:R.M.v0,Kvy:R.M.K.vy,Kr:R.M.K.r,stable:R.stable,PM:R.F.pm,zeta:R.zeta,n:F.length,dB,dph,OSlin:R.smOff.overshoot,OSsim:sm.overshoot,N:R.F.Ncw,P:R.F.P,unst:R.unstableZ};}'''
        for lvl,st in [(6,{}),(6,{'mpcDyn':True}),(6,{'mpcDyn':True,'vcruise':2}),(0,{'veh':'dyn',**PRESETS['slippery'],'vmax':4,'vcruise':1.5,'ctl':'mpc','mpcDyn':True}),(0,{'veh':'dyn',**PRESETS['grippy'],'vmax':4,'vcruise':3,'ctl':'mpc','mpcDyn':True})]:
            r=await pg.evaluate(AN7,{'lvl':lvl,'set':st})
            kv=f"K_vy {r['Kvy']:.3f}, K_r {r['Kr']:.3f}" if r['Kvy'] is not None else 'no tyre gains'
            print(f"  L{lvl+1} {st.get('mpcDyn') and 'tyre model' or 'kinematic '} v {r['v0']:.1f}: {kv}, PM {r['PM'] or 0:.0f}°, ζ {r['zeta'] or 0:.2f} · injection vs model over {r['n']} freqs: {r['dB']:.2f} dB, {r['dph']:.1f}° · step overshoot {r['OSlin']:.1f} % model / {r['OSsim']:.1f} % sim · Nyquist N + P {r['N']+r['P']} vs {r['unst']}")
            if st.get('mpcDyn') and r['Kvy'] is None: fails.append('Analyze did not read the tyre-model gains')
            if r['n']<5 or r['dB']>0.5 or r['dph']>3 or abs(r['OSlin']-r['OSsim'])>0.5 or r['N']+r['P']!=r['unst']: fails.append(f"Analyze L{lvl+1} {st}: {r['dB']:.2f} dB / {r['dph']:.1f}°, overshoot {r['OSlin']:.1f} vs {r['OSsim']:.1f}")
        # no real-time budget here: a solve cut at 15 ms depends on the machine (a fresh worker's first solves run before
        # the JIT has warmed up), and this check asks for the same numbers from the page and the worker
        job={'level':6,'overrides':{'mpcDyn':True,'mpcBudget':0},'seed':7,'secs':20}
        wk=await pg.evaluate(WK,job);pgr=await pg.evaluate(PG,job);ws=wk.get('summary',{})
        same={k:(ws.get(k),pgr[k]) for k in ['goalsDone','coll','cteRMS','dist']}
        print('  L7, tyre-model MPC: worker vs page',same,wk.get('error') or '')
        if wk.get('error') or any(a!=b for a,b in same.values()): fails.append('worker and page differ for the tyre-model MPC')

        print('== 4. L6 missions (low speed, reverse legs) with both presets')
        for name,pr in PRESETS.items():
            r=await pg.evaluate(MISSION,{'lvl':5,'set':{**pr,'carPhys':'dyn'},'secs':300})
            print(f'  {name}',{k:v for k,v in r.items() if k not in('path','cmds')})
            if r['nan'] or r['coll']: fails.append(f'L6 {name}: nan {r["nan"]} collisions {r["coll"]}')
            if name=='grippy' and r['done']!='4/4': fails.append(f'L6 grippy: {r["done"]}')
        print('ERRORS:',errs[:5])
        print('FAILS:',fails)
        await b.close()
asyncio.run(main())
