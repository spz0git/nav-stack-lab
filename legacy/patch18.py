# ---------- fonts: STIX Two for symbols ----------
rep("family=Barlow+Semi+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
    "family=Barlow+Semi+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=STIX+Two+Text:ital,wght@0,400;1,400&display=swap")
rep('  --f-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;',
    '  --f-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;\n  --f-math:"STIX Two Text","Cambria Math","Times New Roman",serif;')

# ---------- layout: observe (left) vs configure (right) ----------
rep("@media (min-width:961px){.stage{position:sticky;top:calc(env(safe-area-inset-top,0px) + 10px)}}",
"""/* wide screens: the parameter console scrolls on its own; the map + telemetry column is sized to fit one screen */
@media (min-width:961px){
  .console{position:sticky;top:calc(env(safe-area-inset-top,0px) + 10px);max-height:calc(100vh - 20px);overflow-y:auto;overscroll-behavior:contain;border-radius:6px}
  .console .tabs{position:sticky;top:0;z-index:2;background:var(--panel);border-radius:6px 6px 0 0}
  .mapwrap{width:min(100%,max(440px,calc((100vh - 460px)*1.5)));margin-inline:auto}
}""")
rep(".tele{padding:14px;display:flex;flex-direction:column;gap:10px}",
""".tele{padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.tele-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:12px;align-items:start}
.tele-log{display:flex;flex-direction:column;gap:6px;min-width:0}
@media (max-width:700px){.tele-grid{grid-template-columns:minmax(0,1fr)}}""")
rep("#plot{width:100%;height:150px;","#plot{width:100%;height:130px;")
rep(".log{list-style:none;margin:0;padding:0;font-family:var(--f-mono);font-size:.76rem;max-height:200px;",".log{list-style:none;margin:0;padding:0;font-family:var(--f-mono);font-size:.74rem;height:110px;")
rep(".metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px 14px;margin:0}",".metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px 14px;margin:0}")
rep(".metrics dd{margin:0;font-family:var(--f-mono);font-size:.9rem;",".metrics dd{margin:0;font-family:var(--f-mono);font-size:.82rem;")
rep(".legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.78rem;color:var(--muted)}",".legend{display:flex;flex-wrap:wrap;gap:3px 12px;font-size:.74rem;color:var(--muted)}")
# nomenclature styles
rep(".codestat{font-family:var(--f-mono);font-size:.78rem}",""".codestat{font-family:var(--f-mono);font-size:.78rem}
.nom{display:flex;flex-direction:column;gap:6px;scroll-margin-top:52px}
.nom h3{border-bottom:1px solid var(--line);padding-bottom:4px}
.nom dl{display:grid;grid-template-columns:minmax(72px,max-content) minmax(0,1fr);gap:5px 14px;margin:0}
.nom dt{font-family:var(--f-math);font-size:1.02rem;line-height:1.35;white-space:nowrap}
.nom dt i{font-style:italic}
.nom dd{margin:0;font-size:.86rem;line-height:1.4;min-width:0}
.nom .unit{color:var(--muted);font-family:var(--f-mono);font-size:.74rem;white-space:nowrap}
.linkbtn{border:0;background:none;padding:0;color:var(--accent);font:inherit;font-size:.86rem;text-decoration:underline;text-underline-offset:2px;cursor:pointer;align-self:flex-start}""")

# ---------- markup: telemetry moves under the map ----------
rep("""      <div class="controls">
        <span class="lbl">Tap map to</span>
        <div class="seg" id="tapmode" aria-label="Map tap action"></div>
        <button class="btn" id="clearwp">Clear waypoints</button>
      </div>
    </section>""","""      <div class="controls">
        <span class="lbl">Tap map to</span>
        <div class="seg" id="tapmode" aria-label="Map tap action"></div>
        <button class="btn" id="clearwp">Clear waypoints</button>
      </div>
      <section class="box tele">
        <div class="tele-head"><h2>Telemetry</h2><div class="seg" id="plotsel" aria-label="Plot channel"></div></div>
        <div class="tele-grid">
          <canvas id="plot" aria-label="Time series plot"></canvas>
          <div class="tele-log"><h3>Event log</h3><ol class="log" id="log"></ol></div>
        </div>
        <dl class="metrics" id="metrics"></dl>
      </section>
    </section>""")
rep("""      <section class="box tele">
        <div class="tele-head"><h2>Telemetry</h2><div class="seg" id="plotsel" aria-label="Plot channel"></div></div>
        <canvas id="plot" aria-label="Time series plot"></canvas>
        <dl class="metrics" id="metrics"></dl>
        <h3>Event log</h3>
        <ol class="log" id="log"></ol>
      </section>
    </aside>""","""    </aside>""")
rep("let tryOpen=window.innerWidth>760;","let tryOpen=false;   // the Try list starts collapsed so the map and telemetry fit on screen")

# ---------- Symbols tab ----------
rep(" {id:'veh',n:'',name:'Vehicle'},{id:'code',n:'',name:'Code'},{id:'view',n:'',name:'Layers'}];",
    " {id:'veh',n:'',name:'Vehicle'},{id:'code',n:'',name:'Code'},{id:'view',n:'',name:'Layers'},{id:'sym',n:'',name:'Symbols'}];")
rep("""  if(t==='code')html=codePane();
  else if(t==='view')html=layersPane();""","""  if(t==='code')html=codePane();
  else if(t==='view')html=layersPane();
  else if(t==='sym')html=symPane();""")
rep("""    if(NOTES[t])html+=`<details class="how" ${t==='loc'||t==='ctl'?'':''}><summary>How it works</summary><div class="how-body">${NOTES[t]}</div></details>`;""",
"""    if(NOTES[t])html+=`<details class="how" ${howOpen[t]?'open':''} data-how="${t}"><summary>How it works</summary><div class="how-body">${NOTES[t]}<button class="linkbtn" data-sym="${t}">Symbol definitions for this section</button>${t==='ctl'?'<button class="linkbtn" data-sym="mpc">MPC symbols</button>':''}</div></details>`;""")
rep("  if(t==='code')wireCode();","""  pane.querySelectorAll('details[data-how]').forEach(d=>d.ontoggle=()=>{howOpen[d.dataset.how]=d.open;});
  pane.querySelectorAll('[data-sym]').forEach(b=>b.onclick=()=>{activeTab='sym';buildTabs();renderAllPanes();const el=document.getElementById('sym-'+b.dataset.sym);if(el)el.scrollIntoView({block:'start'});});
  if(t==='code')wireCode();""")
rep("let activeTab='loc';","let activeTab='loc';const howOpen={};")
rep("function layersPane(){",r"""// Nomenclature, IEEE style: symbol — definition [unit], grouped by subsystem
const I=s=>`<i>${s}</i>`;
const NOMEN=[
 {id:'veh',title:'Vehicle and motion',rows:[
  [`${I('x')}, ${I('y')}`,'Position of the robot reference point in the world frame (rear-axle centre for the car)','m'],
  ['θ','Heading (yaw), counter-clockwise from +x','rad'],
  [I('v'),'Longitudinal speed, negative when reversing','m/s'],
  ['ω','Yaw rate, θ̇','rad/s'],
  [I('a'),'Longitudinal acceleration','m/s²'],
  ['α','Angular acceleration (diff-drive)','rad/s²'],
  [`${I('v')}<sub>max</sub>, ω<sub>max</sub>`,'Speed and yaw-rate limits','m/s, rad/s'],
  [`${I('a')}<sub>max</sub>, α<sub>max</sub>`,'Acceleration limits','m/s², rad/s²'],
  ['τ','Time constant of the first-order actuator lag','s'],
  [`Δ${I('t')}`,'Time step: 0.05 s for the simulation, tunable for the MPC prediction','s'],
  [I('L'),'Wheelbase (written L<sub>wb</sub> where L could be confused)','m'],
  ['δ','Front-wheel steering angle','rad'],
  ['δ<sub>max</sub>','Steering-angle limit','rad'],
  ['δ̇','Steering rate','rad/s'],
  [`${I('R')}<sub>min</sub>`,`Minimum turning radius, ${I('L')} / tan δ<sub>max</sub>`,'m'],
  ['κ','Path curvature, positive to the left','1/m'],
  [I('r'),'Robot radius (diff-drive, 0.3 m) or covering-circle radius (car)','m']]},
 {id:'loc',title:'Localization',rows:[
  ['μ',`Pose estimate (mean), [${I('x̂')}, ${I('ŷ')}, θ̂]`,'m, rad'],
  ['Σ','Pose-estimate covariance, 3 × 3',''],
  [I('u'),`Odometry input, (${I('v')}, ω)`,'m/s, rad/s'],
  [`${I('g')}(μ, ${I('u')})`,'Discrete motion model',''],
  [`${I('G')}, ${I('V')}`,`Jacobians of ${I('g')} with respect to the state and the input`,''],
  [I('M'),'Odometry noise covariance, diag(σ<sub>v</sub>², σ<sub>ω</sub>²)',''],
  ['σ<sub>v</sub>, σ<sub>ω</sub>','Odometry noise standard deviations','m/s, rad/s'],
  [I('k'),'Odometry noise scale (Vehicle slider); the filter assumes its own multiple of it',''],
  [I('b'),'Odometry calibration bias, not modelled by the filters',''],
  [`${I('z')} = [${I('r')}, φ]`,'Beacon measurement: range and bearing','m, rad'],
  [I('ẑ'),'Predicted measurement','m, rad'],
  [I('q'),'Squared distance to the beacon, Δx² + Δy²','m²'],
  ['ν',`Innovation, ${I('z')} − ${I('ẑ')}`,'m, rad'],
  [I('H'),`Measurement Jacobian, ∂${I('ẑ')}/∂μ`,''],
  [I('Q'),'Measurement noise covariance, diag(σ<sub>r</sub>², σ<sub>φ</sub>²)',''],
  [I('S'),`Innovation covariance, ${I('H')}Σ${I('H')}ᵀ + ${I('Q')}`,''],
  [I('K'),`Kalman gain, Σ${I('H')}ᵀ${I('S')}⁻¹`,''],
  [`${I('d')}²`,`Squared Mahalanobis distance, νᵀ${I('S')}⁻¹ν; readings with ${I('d')}² > 9.21 (χ²₂, 99 %) are rejected`,''],
  [I('N'),'Number of particles',''],
  [`${I('w')}<sub>i</sub>`,`Normalized weight of particle ${I('i')}`,''],
  [`${I('N')}<sub>eff</sub>`,`Effective sample size, 1 / Σ ${I('w')}<sub>i</sub>²; resample when below ${I('N')}/2`,''],
  ['α<sub>fast</sub>, α<sub>slow</sub>','Smoothing rates of the short- and long-term likelihood averages (augmented MCL)',''],
  [I('e'),'Pose error, truth − estimate','m, rad'],
  ['NEES',`Normalized estimation error squared, ${I('e')}ᵀΣ⁻¹${I('e')}; about 3 when the filter is consistent`,'']]},
 {id:'per',title:'Perception',rows:[
  [I('l'),'Log-odds of a grid cell being occupied; 0 = unknown',''],
  [`${I('l')}<sub>free</sub>, ${I('l')}<sub>hit</sub>`,'Log-odds increments for a cell a beam passes through / ends in',''],
  [`${I('d')}(${I('c')})`,`Distance from cell ${I('c')} to the nearest occupied cell (distance transform)`,'m'],
  [`${I('r')}<sub>lethal</sub>`,'Cells closer than this to an obstacle are forbidden (0.4 m)','m'],
  ['σ<sub>lidar</sub>','Lidar range noise standard deviation','m']]},
 {id:'mis',title:'Mission',rows:[
  [`${I('C')}<sub>ij</sub>`,`Path cost from waypoint ${I('i')} to ${I('j')} (Dijkstra on the costmap), used to order waypoints`,'m'],
  ['σ<sub>pos</sub>','Position uncertainty, √(Σ<sub>xx</sub> + Σ<sub>yy</sub>), checked by the lost guard','m']]},
 {id:'plan',title:'Planning',rows:[
  [`${I('g')}(${I('n')})`,`Cost-to-come of search node ${I('n')}`,'m'],
  [`${I('h')}(${I('n')})`,'Heuristic estimate of the cost-to-go','m'],
  [`${I('f')}(${I('n')})`,`Search priority, ${I('g')} + ε${I('h')}`,'m'],
  ['ε','Heuristic weight; ε > 1 gives weighted A*, with cost ≤ ε × optimal',''],
  [I('n'),'Number of nodes in the RRT* tree',''],
  [`${I('r')}<sub>n</sub>`,'RRT* rewiring radius, min(8√(log n / n), 1.5 m)','m'],
  ['L, R, S','Reeds–Shepp segments: left arc, right arc, straight',''],
  ['⁺, ⁻','Segment driven forward / in reverse',''],
  [I('p'),'Fraction of δ<sub>max</sub> the car planners may use',''],
  [`${I('R')}<sub>plan</sub>`,`Planning turning radius, ${I('L')} / tan(${I('p')} δ<sub>max</sub>)`,'m']]},
 {id:'ctl',title:'Path tracking',rows:[
  [I('s'),'Arc length along the path','m'],
  [`${I('e')}, ${I('e')}<sub>lat</sub>`,'Lateral (cross-track) error, positive to the left of the path','m'],
  [`${I('e')}<sub>lon</sub>`,'Along-track error','m'],
  ['θ<sub>e</sub>','Heading error relative to the path tangent','rad'],
  [`${I('L')}<sub>d</sub>`,`Pure-pursuit lookahead, ${I('L')}<sub>0</sub> + ${I('k')}·${I('v')}`,'m'],
  [`${I('L')}<sub>0</sub>, ${I('k')}`,'Lookahead offset and speed gain','m, s'],
  ['α','In pure pursuit: bearing from the heading to the carrot point','rad'],
  [`${I('a')}<sub>lat</sub>`,`Lateral-acceleration limit of the speed profile, ${I('v')} ≤ √(${I('a')}<sub>lat</sub>/|κ|)`,'m/s²'],
  [`${I('k')}<sub>θ</sub>, ${I('k')}<sub>e</sub>`,'Rear-wheel feedback heading and lateral gains','1/m, 1/m²'],
  [I('k'),'In Stanley: cross-track gain',''],
  [`${I('e')}<sub>front</sub>`,'Stanley cross-track error of the front axle','m'],
  [`${I('K')}<sub>p</sub>, ${I('K')}<sub>i</sub>, ${I('K')}<sub>d</sub>`,'PID gains on the heading error',''],
  [`${I('w')}<sub>g</sub>, ${I('w')}<sub>o</sub>, ${I('w')}<sub>v</sub>`,'DWA weights on goal progress, clearance and speed',''],
  [I('J'),'Cost being minimized (DWA score, MPC objective)','']]},
 {id:'mpc',title:'Model predictive control',rows:[
  [`${I('N')}<sub>p</sub>`,'Prediction horizon: steps the model looks ahead',''],
  [`${I('N')}<sub>c</sub>`,`Control horizon: free input moves; <b>u</b><sub>k</sub> = <b>u</b><sub>N<sub>c</sub>−1</sub> for ${I('k')} ≥ ${I('N')}<sub>c</sub>`,''],
  ['<b>x</b>',`MPC state [${I('x')}, ${I('y')}, θ, ${I('v')}, ${I('s')}], plus [${I('v')}<sub>cmd</sub>, ${I('s')}<sub>cmd</sub>] with the lag model`,''],
  [I('s'),'In the MPC: turn state, ω for diff-drive or δ for the car','rad/s or rad'],
  ['<b>u</b>',`MPC input [${I('a')}, ${I('ṡ')}]`,'m/s², rad/s² or rad/s'],
  ['<b>U</b>',`Decision vector: the ${I('N')}<sub>c</sub> input moves (2${I('N')}<sub>c</sub> variables)`,''],
  [`${I('Q')}<sub>lon</sub>, ${I('Q')}<sub>lat</sub>, ${I('Q')}<sub>θ</sub>, ${I('Q')}<sub>v</sub>`,'Weights on along-track, lateral, heading and speed error',''],
  [`${I('w')}<sub>N<sub>p</sub></sub>`,'Terminal weight multiplier on the last step',''],
  [`${I('R')}<sub>a</sub>, ${I('R')}<sub>s</sub>`,`Input weights on ${I('a')} and ${I('ṡ')}`,''],
  [`${I('R')}<sub>Δ</sub>`,'Weight on the change between consecutive input moves',''],
  [`${I('c')}(<b>x</b>) ≤ 0`,`Inequality constraints: speed sign and limit, |${I('s')}| ≤ ${I('s')}<sub>max</sub>, obstacle clearance`,''],
  ['ρ','Augmented-Lagrangian penalty parameter',''],
  ['λ',`Lagrange-multiplier estimates, updated λ ← max(0, λ + ρ${I('c')})`,''],
  [`${I('A')}<sub>k</sub>, ${I('B')}<sub>k</sub>`,`Model Jacobians ∂${I('f')}/∂<b>x</b> and ∂${I('f')}/∂<b>u</b> at step ${I('k')}`,''],
  [`${I('S')}<sub>k</sub>`,`Sensitivity of the predicted state to the decision vector, ∂<b>x</b><sub>k</sub>/∂<b>U</b>`,''],
  [`<b>r</b>, ${I('J')}`,`In Gauss–Newton: residual vector and its Jacobian ∂<b>r</b>/∂<b>U</b>`,''],
  [`${I('H')}, ${I('g')}`,`In Gauss–Newton: Hessian approximation ${I('J')}ᵀ${I('J')} and gradient ${I('J')}ᵀ<b>r</b>`,'']]},
 {id:'tele',title:'Telemetry',rows:[
  ['RMS','Root mean square over the run',''],
  ['true error','Distance between the true pose and the goal when the robot declares arrival','m, °']]},
];
function symPane(){
  return`<p class="note">Notation follows the usual IEEE style. Some letters are reused between subsystems, as in the literature (for example ${I('g')}, ${I('H')}, ${I('S')}, ${I('J')}, ${I('k')}, α and ${I('s')}). The group heading tells you which meaning applies. SI units; angles in radians unless a panel shows degrees.</p>`+
    NOMEN.map(g=>`<section class="nom" id="sym-${g.id}"><h3>${g.title}</h3><dl>${g.rows.map(([sy,d,u])=>`<dt>${sy}</dt><dd>${d}${u?` <span class="unit">[${u}]</span>`:''}</dd>`).join('')}</dl></section>`).join('');
}
function layersPane(){""")
