BUNDLE=open('an/bundle.js').read()
# ---------- sim: latency, actuator bias ----------
rep("rwKth:3.0,rwKe:6.0,","rwKth:3.0,rwKe:6.0,latency:0,biasDeg:0,biasW:0,")
rep("""    wt=vt*Math.tan(r.d)/P.wheelbase;
  }else{
    wt=clamp(c.w,-P.wmax,P.wmax);
    if(P.lag>0){const a=1-Math.exp(-DT/P.lag);vt=r.v+(vt-r.v)*a;wt=r.w+(wt-r.w)*a;}
    if(P.accel){vt=clamp(vt,r.v-P.amax*DT,r.v+P.amax*DT);wt=clamp(wt,r.w-P.alpha*DT,r.w+P.alpha*DT);}
  }""","""    wt=vt*Math.tan(r.d+(P.biasDeg||0)*Math.PI/180)/P.wheelbase;   // misalignment: the wheels sit biasDeg off what the encoder reads
  }else{
    const wa=r.wa??r.w;   // actuator state (turn rate the motors are trying to produce)
    wt=clamp(c.w,-P.wmax,P.wmax);
    if(P.lag>0){const a=1-Math.exp(-DT/P.lag);vt=r.v+(vt-r.v)*a;wt=wa+(wt-wa)*a;}
    if(P.accel){vt=clamp(vt,r.v-P.amax*DT,r.v+P.amax*DT);wt=clamp(wt,wa-P.alpha*DT,wa+P.alpha*DT);}
    r.wa=wt;wt+=P.biasW||0;   // bias: e.g. one weaker motor
  }""")
rep("      S.cmd=normCmd(cmd);","      applyCmd(normCmd(cmd));")
rep("async function advance(n){","""// Control latency: commands wait latency/DT ticks before reaching the actuators
function applyCmd(c){const n=Math.round(P.latency/DT);if(!n){S.cmd=c;S.cmdQ=[];return;}if(!S.cmdQ)S.cmdQ=[];S.cmdQ.push(c);while(S.cmdQ.length>n)S.cmd=S.cmdQ.shift();}
async function advance(n){""")
rep("cmd:{v:0,w:0,steer:0},odo:{v:0,w:0},plan:null,segIdx:0,","cmd:{v:0,w:0,steer:0},cmdQ:[],odo:{v:0,w:0},plan:null,segIdx:0,")
rep("      {k:'lag',label:'Actuator lag τ',min:0,max:0.6,step:0.01,unit:'s'},",
"""      {k:'lag',label:'Actuator lag τ',min:0,max:0.6,step:0.01,unit:'s'},
      {k:'latency',label:'Control latency (whole ticks)',min:0,max:0.5,step:0.05,unit:'s'},
      {k:'biasDeg',label:'Steering misalignment (bias)',min:-5,max:5,step:0.25,unit:'°',show:isCar},
      {k:'biasW',label:'Turn-rate bias (e.g. weak motor)',min:-0.3,max:0.3,step:0.01,unit:'rad/s',show:()=>!isCar()},""")
# ---------- analysis code ----------
rep("/* ---------- transport & tap ---------- */",BUNDLE+"\n/* ---------- transport & tap ---------- */")
# ---------- markup ----------
rep("""    <section class="stage">
      <div class="status" id="status"></div>""","""    <section class="stage">
      <div class="modebar"><div class="seg" id="modesel" aria-label="View"></div><span class="lbl" id="modehint">Linear analysis of the tracking loop, with guided lessons in the Learn tab</span></div>
      <div id="simview" class="view">
      <div class="status" id="status"></div>""")
rep("""        <dl class="metrics" id="metrics"></dl>
      </section>
    </section>""","""        <dl class="metrics" id="metrics"></dl>
      </section>
      </div>
      <div id="anview" class="view" hidden>
        <p class="an-op" id="an-op"></p>
        <div id="an-none" class="box an-none" hidden></div>
        <div id="an-body">
          <div class="an-diagram" id="an-diagram"></div>
          <div class="an-chips" id="an-chips"></div>
          <div class="an-grid">
            <figure class="an-fig"><figcaption><span>Bode · open loop L(jω)</span><span class="seg sm" id="an-cl"></span></figcaption><canvas id="cv-bode" aria-label="Bode plot"></canvas></figure>
            <figure class="an-fig"><figcaption><span>Nyquist</span><span class="seg sm" id="an-nyq"></span></figcaption><canvas id="cv-nyq" aria-label="Nyquist plot"></canvas></figure>
            <figure class="an-fig"><figcaption><span>Time response</span><span class="seg sm" id="an-kind"></span></figcaption><canvas id="cv-step" aria-label="Step response"></canvas></figure>
            <figure class="an-fig"><figcaption><span>Poles · root locus</span><span class="lbl">s-plane [1/s]</span></figcaption><canvas id="cv-pz" aria-label="Pole-zero map"></canvas></figure>
          </div>
          <div class="an-exp">
            <span class="lbl">Check in the simulator</span>
            <button class="btn" id="an-step">Run step test</button>
            <select class="sel" id="an-amp" aria-label="Step size"><option value="0.05">0.05 m offset</option><option value="0.2" selected>0.2 m offset</option><option value="0.5">0.5 m offset</option><option value="1">1.0 m offset</option></select>
            <button class="btn" id="an-inj">Measure L(jω)</button>
            <select class="sel" id="an-inja" aria-label="Injection amplitude"><option value="small">small sine</option><option value="large">large sine</option></select>
            <span class="an-msg" id="an-msg"></span>
          </div>
          <p class="note an-foot">Bode and Nyquist: continuous vehicle behind a zero-order hold (delay T/2 plus latency), with the 20 Hz controller and actuator elements evaluated exactly at z = e^(sT). Poles and the predicted response: the exact 20 Hz discrete loop. Amber points and dashed curves: measured in the full nonlinear simulator.</p>
        </div>
      </div>
    </section>""")
# ---------- CSS ----------
rep(".codestat{font-family:var(--f-mono);font-size:.78rem}",""".codestat{font-family:var(--f-mono);font-size:.78rem}
.modebar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px}
.view{display:flex;flex-direction:column;gap:10px;min-width:0}
.view>*{flex-shrink:0}
.view[hidden]{display:none}
.an-op{margin:0;font-size:.84rem;color:var(--muted)}
.an-op b{color:var(--ink)}
.an-none{padding:14px;font-size:.92rem}
#an-body{display:flex;flex-direction:column;gap:10px}
.an-diagram{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:4px 6px;overflow-x:auto}
.bd{display:block;width:100%;min-width:560px;height:auto}
.bd-box{fill:var(--raise);stroke:var(--ink);stroke-width:1.2}
.bd-t{fill:var(--ink);font-family:var(--f-display);font-weight:600;font-size:14px;text-anchor:middle}
.bd-s{fill:var(--muted);font-family:var(--f-mono);font-size:10.5px;text-anchor:middle}
.bd-l{stroke:var(--ink);stroke-width:1.2}
.bd-a{fill:var(--ink)}
.bd-dash{stroke-dasharray:4 3;stroke:var(--muted)}
.an-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.chip{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--line);border-radius:5px;padding:4px 8px;display:flex;flex-direction:column;min-width:0}
.chip span{font-size:.66rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.chip b{font-family:var(--f-mono);font-weight:500;font-size:.84rem;overflow-wrap:anywhere}
.chip.good{border-left-color:var(--ok)} .chip.warnc{border-left-color:var(--warn)} .chip.badc{border-left-color:var(--bad)}
.an-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (max-width:700px){.an-grid{grid-template-columns:minmax(0,1fr)}}
.an-fig{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:6px 8px 8px;display:flex;flex-direction:column;gap:4px;min-width:0}
.an-fig figcaption{display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;font-family:var(--f-display);font-weight:600;font-size:.92rem}
.an-fig canvas{width:100%;height:230px;display:block;border-radius:4px}
.seg.sm button{padding:2px 7px;font-size:.74rem}
.an-exp{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.an-msg{font-size:.82rem;color:var(--muted);flex:1 1 220px}
.an-foot{font-size:.78rem}
.btn.small{padding:4px 9px;font-size:.84rem}
.tries{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.lesson{border-top:1px solid var(--line);padding:8px 0 4px}
.lesson summary{cursor:pointer;font-family:var(--f-display);font-weight:600;font-size:1rem;display:flex;gap:8px;align-items:baseline}
.lesson .lnum{font-family:var(--f-mono);font-size:.74rem;color:var(--muted);font-weight:400;min-width:1.4em}""")
# ---------- tabs / panes ----------
rep("{id:'sym',n:'',name:'Symbols'}];","{id:'sym',n:'',name:'Symbols'},{id:'learn',n:'',name:'Learn'}];")
rep("  else if(t==='sym')html=symPane();","  else if(t==='sym')html=symPane();\n  else if(t==='learn')html=learnPane();")
rep("  if(t==='code')wireCode();","  if(t==='code')wireCode();\n  if(t==='learn')wireLearn(pane);")
# ---------- hooks ----------
rep("""  if(['wheelbase','steerMaxDeg','revOK','revPen','gearPen','hybH','planPct'].includes(k)&&!live&&(P.plan==='hybrid'||P.plan==='rs'))requestReplan('vehicle or planner changed');
  draw();refreshAll();
}""","""  if(['wheelbase','steerMaxDeg','revOK','revPen','gearPen','hybH','planPct'].includes(k)&&!live&&(P.plan==='hybrid'||P.plan==='rs'))requestReplan('vehicle or planner changed');
  anInvalidate();
  if(AN.mode==='sim'){draw();refreshAll();}
}""")
rep("  running=false;buildLevels();reset();renderAllPanes();\n}","  running=false;buildLevels();reset();renderAllPanes();anInvalidate();\n}")
rep("""  draw();
  if(frame++%3===0){drawPlot();refreshAll();}
  requestAnimationFrame(loop);""","""  if(AN.mode==='sim'){draw();if(frame++%3===0){drawPlot();refreshAll();}}
  requestAnimationFrame(loop);""")
rep("const mo=new MutationObserver(()=>{tokKey='';});","const mo=new MutationObserver(()=>{tokKey='';if(AN.mode==='an')renderAnalysis();});")
rep("window.addEventListener('resize',()=>{draw();drawPlot();});","window.addEventListener('resize',()=>{if(AN.mode==='an')renderAnalysis();else{draw();drawPlot();}});\nmatchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{tokKey='';if(AN.mode==='an')setTimeout(renderAnalysis,30);});")
rep("$('#legendmore').onclick=()=>showSym('map');","""$('#legendmore').onclick=()=>showSym('map');
seg($('#modesel'),[['sim','Simulation'],['an','Analysis']],()=>AN.mode,v=>setMode(v));
function syncAnControls(){
  seg($('#an-cl'),[['0','L only'],['1','+ closed loop']],()=>AN.showCL?'1':'0',v=>{AN.showCL=v==='1';renderAnalysis();});
  seg($('#an-nyq'),[['log','compressed'],['lin','linear']],()=>AN.nyqScale,v=>{AN.nyqScale=v;renderAnalysis();});
  seg($('#an-kind'),[['offset','path offset'],['bias','actuator bias']],()=>AN.stepKind,v=>{AN.stepKind=v;renderAnalysis();});
  $('#an-amp').value=String(AN.stepAmp);$('#an-inja').value=AN.injAmp;
}
syncAnControls();
$('#an-amp').onchange=e=>{AN.stepAmp=+e.target.value;};
$('#an-inja').onchange=e=>{AN.injAmp=e.target.value;};
$('#an-step').onclick=()=>{if(!AN.res)anCompute();runStepTest();AN.msg=`Step test: ${AN.stepKind==='offset'?AN.stepAmp+' m path offset':biasUnit().val+biasUnit().unit+' actuator bias'} in the full simulator (dashed amber).`;renderAnalysis();};
$('#an-inj').onclick=()=>{if(!AN.busy)runInjection();};""")
# nomenclature group
rep(" {id:'tele',title:'Telemetry',rows:[",""" {id:'an',title:'Loop analysis',rows:[
  [`${I('L')}(${I('s')})`,'Open-loop transfer function, broken at the actuator command',''],
  [`${I('S')}(${I('s')})`,`Sensitivity, 1/(1+${I('L')}); its peak is ${I('M')}<sub>s</sub>`,''],
  [`${I('T')}(${I('s')})`,'Closed-loop response of lateral position to a path offset',''],
  [I('g'),`Plant gain from steering command to heading rate: 1 (diff-drive) or ${I('v')}<sub>0</sub>/${I('L')} (car)`,'1/s per unit'],
  [`${I('v')}<sub>0</sub>`,'Operating speed of the analysis (the cruise speed)','m/s'],
  [`${I('K')}<sub>e</sub>, ${I('K')}<sub>θ</sub>`,'Linearized controller gains on lateral and heading error, read from the code','per m, per rad'],
  [`${I('K')}<sub>s</sub>, ${I('K')}<sub>c</sub>, ${I('K')}<sub>u</sub>`,'MPC gains on the actuator state, the commanded state and the previous input move',''],
  [`${I('T')}`,'Sample time of the simulation, 0.05 s','s'],
  [`${I('T')}<sub>d</sub>`,`Loop delay: ${I('T')}/2 for the sample-and-hold, plus latency`,'s'],
  [`${I('a')}`,`Fraction of an MPC rate step that reaches a lagging actuator per tick, 1 − e<sup>−T/τ</sup>`,''],
  [`ω<sub>c</sub>`,`Gain crossover, |${I('L')}(jω<sub>c</sub>)| = 1`,'rad/s'],
  ['PM',`Phase margin, 180° + ∠${I('L')}(jω<sub>c</sub>)`,'°'],
  ['GM',`Gain margin, −20 log<sub>10</sub>|${I('L')}| where the phase is −180°`,'dB'],
  ['DM','Delay margin, PM/ω<sub>c</sub>: extra latency before instability','s'],
  [`${I('M')}<sub>s</sub>`,`Peak sensitivity, 1 / (closest distance from ${I('L')} to −1)`,''],
  [`${I('N')}, ${I('P')}, ${I('Z')}`,`Nyquist: clockwise encirclements of −1, unstable open-loop poles, unstable closed-loop poles; ${I('Z')} = ${I('N')} + ${I('P')}`,''],
  ['ζ, ω<sub>n</sub>','Damping ratio and natural frequency of the dominant closed-loop pole pair','—, rad/s'],
  [`${I('z')}`,`Discrete-time pole; ${I('s')} = ln ${I('z')} / ${I('T')}`,''],
  [`π/${I('T')}`,'Nyquist frequency of the sampled loop (62.8 rad/s)','rad/s'],
  [`${I('e')}<sub>ss</sub>`,'Steady-state lateral error left by a constant actuator bias','m']]},
 {id:'tele',title:'Telemetry',rows:[""")
