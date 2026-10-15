import asyncio, math, os, sys
from playwright.async_api import async_playwright
# The car with tyre slip (P.carPhys 'dyn', core/vehicle.js), checked against what chapter 1 §4–5 predicts:
#  1. stiff tyres: a whole L6 mission's true path matches the kinematic car (max gap ≲ 1 cm)
#  2. steady circles: r/δ = v / (L + K_us v²) within 2 % (forward; reverse against the linear model with v_x < 0)
#  3. step steer above v_ch on the slippery preset: the yaw-rate overshoot and peak time of the linear model (ζ < 1)
#  4. missions: L6 with both presets (low speed, reverse legs) completes without collisions or NaN
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
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        pg=await b.new_page(viewport={'width':1280,'height':900})
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto('file://'+os.path.abspath('wrapped.html'))
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
