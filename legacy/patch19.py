# ---------- one-screen desktop layout ----------
rep("""<div class="wrap">
  <header class="top">
    <h1>Nav Stack Lab</h1>
    <p class="sub">diff-drive or car-like robot · 24 × 16 m world · 20 Hz fixed step</p>
  </header>
  <nav class="levels" id="levels" aria-label="Scenario level"></nav>
  <section class="brief" id="brief" aria-live="polite"></section>

  <main class="layout">
    <section class="stage">
      <div class="status" id="status"></div>""","""<div class="wrap">
  <main class="layout">
    <section class="ctx">
      <header class="top">
        <h1>Nav Stack Lab</h1>
        <p class="sub">diff-drive or car-like robot · 24 × 16 m · 20 Hz</p>
      </header>
      <nav class="levels" id="levels" aria-label="Scenario level"></nav>
      <section class="brief" id="brief" aria-live="polite"></section>
    </section>
    <section class="stage">
      <div class="status" id="status"></div>
      <div class="controls">
        <button class="btn primary" id="run">Run</button>
        <button class="btn" id="stepb">Step 0.5 s</button>
        <button class="btn" id="resetb">Reset</button>
        <div class="seg" id="speed" aria-label="Simulation speed"></div>
        <span class="ctl-sep"></span>
        <label class="lbl" for="tapsel">Tap map</label>
        <select class="sel" id="tapsel">
          <option value="wp">Add waypoint</option>
          <option value="pose">Add posed goal (drag)</option>
          <option value="goal">Set single goal</option>
          <option value="kidnap">Kidnap robot</option>
        </select>
        <button class="btn" id="clearwp">Clear waypoints</button>
      </div>""")
rep("""      <div class="controls">
        <button class="btn primary" id="run">Run</button>
        <button class="btn" id="stepb">Step 0.5 s</button>
        <button class="btn" id="resetb">Reset</button>
        <div class="seg" id="speed" aria-label="Simulation speed"></div>
      </div>
      <div class="controls">
        <span class="lbl">Tap map to</span>
        <div class="seg" id="tapmode" aria-label="Map tap action"></div>
        <button class="btn" id="clearwp">Clear waypoints</button>
      </div>
""","")
rep("""        <span><i class="disc" style="background:var(--ink)"></i>true pose</span>
        <span><i class="ring" style="border-color:var(--accent)"></i>estimate</span>
        <span><i style="border-color:var(--accent)"></i>global path</span>
        <span><i class="dash" style="border-color:var(--warn)"></i>reverse leg</span>
        <span><i class="dot" style="background:var(--rose)"></i>belief (particles / 95% ellipse)</span>
        <span><i class="dot" style="background:var(--amber)"></i>lidar hits</span>
        <span><i class="dot" style="background:var(--beacon);border-radius:1px;transform:rotate(45deg)"></i>beacons & readings (red = false)</span>
        <span><i class="disc" style="background:var(--warn)"></i>people</span>
        <span><i style="border-color:var(--ok)"></i>MPC prediction (LTV: dashed = linear model)</span>""",
"""        <span><i class="disc" style="background:var(--ink)"></i>true pose</span>
        <span><i class="ring" style="border-color:var(--accent)"></i>estimate</span>
        <span><i style="border-color:var(--accent)"></i>path</span>
        <span><i class="dash" style="border-color:var(--warn)"></i>reverse</span>
        <span><i class="dot" style="background:var(--rose)"></i>belief</span>
        <span><i class="dot" style="background:var(--amber)"></i>lidar</span>
        <span><i class="dot" style="background:var(--beacon);border-radius:1px;transform:rotate(45deg)"></i>beacon</span>
        <span><i class="disc" style="background:var(--warn)"></i>people</span>
        <span><i style="border-color:var(--ok)"></i>MPC</span>
        <button class="linkbtn" id="legendmore" type="button">All map symbols</button>""")
# CSS
rep("body{color:var(--ink);font-family:var(--f-body);font-size:15px;line-height:1.45;padding-inline:16px;padding-block:14px 40px}",
    "body{color:var(--ink);font-family:var(--f-body);font-size:15px;line-height:1.45;padding-inline:16px;padding-block:14px 40px}\n.ctx{display:flex;flex-direction:column;gap:10px;min-width:0}")
rep(".wrap{max-width:1320px;margin:0 auto;display:flex;flex-direction:column;gap:14px}",".wrap{max-width:1600px;margin:0 auto}")
rep(".layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(330px,1fr);gap:16px;align-items:start}\n@media (max-width:960px){.layout{grid-template-columns:minmax(0,1fr)}}",
    ".layout{display:flex;flex-direction:column;gap:14px}")
rep("""@media (min-width:961px){
  .console{position:sticky;top:calc(env(safe-area-inset-top,0px) + 10px);max-height:calc(100vh - 20px);overflow-y:auto;overscroll-behavior:contain;border-radius:6px}
  .console .tabs{position:sticky;top:0;z-index:2;background:var(--panel);border-radius:6px 6px 0 0}
  .mapwrap{width:min(100%,max(440px,calc((100vh - 460px)*1.5)));margin-inline:auto}
}""","""/* Desktop: the whole lab is one screen. Left: map + telemetry (what you watch).
   Right: level, brief and parameter tabs (what you change), each scrolling on its own. */
@media (min-width:961px) and (min-height:600px){
  body{padding-block:12px}
  .layout{display:grid;height:calc(100vh - 24px);grid-template-columns:minmax(0,1.5fr) minmax(360px,1fr);grid-template-rows:auto minmax(0,1fr);grid-template-areas:"stage ctx" "stage console";gap:12px 16px}
  .ctx{grid-area:ctx;max-height:46vh;overflow-y:auto;overscroll-behavior:contain}
  .stage{grid-area:stage;min-height:0;overflow-y:auto;overscroll-behavior:contain}
  .console{grid-area:console;min-height:0;overflow-y:auto;overscroll-behavior:contain;border-radius:6px}
  .console .tabs{position:sticky;top:0;z-index:2;background:var(--panel);border-radius:6px 6px 0 0}
  .mapwrap{width:min(100%,max(420px,calc((100vh - 400px)*1.5)));margin-inline:auto}
  .levels{flex-wrap:wrap;overflow:visible}
  .lvl{min-width:0;flex:1 1 104px;padding:5px 10px 6px}
  .lvl span{font-size:.95rem}
}""")
rep(".brief{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 14px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:6px 24px}",
    ".brief{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px 14px;display:grid;grid-template-columns:minmax(0,1fr);gap:6px}")
rep("@media (max-width:760px){.brief{grid-template-columns:minmax(0,1fr)}}","")
rep(".controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}\n.ctl-sep{width:1px;align-self:stretch;background:var(--line);margin-inline:4px}\n.sel{font:inherit;font-size:.9rem;color:var(--ink);background:var(--raise);border:1px solid var(--line);border-radius:5px;padding:6px 8px}")
rep(".brief .adds{font-size:.95rem}",".brief .adds{font-size:.92rem}")
# compact metrics: label and value on one line
rep(".metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px 14px;margin:0}\n.metrics div{min-width:0}",
    ".metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:3px 16px;margin:0}\n.metrics div{min-width:0;display:flex;gap:8px;align-items:baseline}")
rep(".metrics dt{font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}",".metrics dt{font-size:.66rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);white-space:nowrap}")
rep("#plot{width:100%;height:130px;","#plot{width:100%;height:124px;")
rep("font-size:.74rem;height:110px;","font-size:.72rem;height:100px;")
# metric labels shorter
rep("['Distance driven',","['Distance',")
rep("['NEES (mean, 3 is consistent)',nees==null?'— (no covariance)'","['NEES (≈3 = consistent)',nees==null?'— (no covariance)'")
rep("['MPC max violation',","['MPC violation',")
# tap select wiring
rep("seg($('#tapmode'),[['wp','Add waypoint'],['pose','Add posed goal (drag)'],['goal','Set single goal'],['kidnap','Kidnap robot']],()=>tapMode,v=>{tapMode=v;cv.style.touchAction=v==='pose'?'none':'manipulation';});",
    "$('#tapsel').onchange=e=>{tapMode=e.target.value;cv.style.touchAction=tapMode==='pose'?'none':'manipulation';};\n$('#legendmore').onclick=()=>{activeTab='sym';buildTabs();renderAllPanes();const el=document.getElementById('sym-map');if(el)el.scrollIntoView({block:'start'});};")
# Map symbols group in the nomenclature
rep(" {id:'tele',title:'Telemetry',rows:[",""" {id:'map',title:'Map symbols',rows:[
  ['<i class="swatch" style="background:var(--ink)"></i>','True pose (ground truth); the car is drawn with its wheels at the actual steering angle',''],
  ['<i class="swatch ring" style="border-color:var(--accent)"></i>','Estimated pose, dashed outline with a heading line',''],
  ['<i class="swatch line" style="border-color:var(--accent)"></i>','Global path, forward leg; finished legs fade',''],
  ['<i class="swatch line dash" style="border-color:var(--warn)"></i>','Global path, reverse leg (car)',''],
  ['<i class="swatch" style="background:var(--rose)"></i>','Belief: particles (particle filter) or 95 % covariance ellipse (EKF, dead reckoning)',''],
  ['<i class="swatch sq" style="background:var(--amber)"></i>','Lidar hits, placed using the estimated pose',''],
  ['<i class="swatch dia" style="background:var(--beacon)"></i>','Beacons (known positions) and the current range–bearing readings drawn from the estimate; red readings are false detections',''],
  ['<i class="swatch" style="background:var(--warn)"></i>','People, with a velocity tick',''],
  ['<i class="swatch ring" style="border-color:var(--ok)"></i>','Active waypoint; numbers give the visiting order; a dashed body and tick show a goal heading',''],
  ['<i class="swatch line" style="border-color:var(--ok)"></i>','MPC predicted trajectory; dots are the reference points. In LTV mode the dashed pink line is the linear model\\'s prediction',''],
  ['<i class="swatch sq" style="background:var(--accent);opacity:.4"></i>','Planner search: A* closed set, RRT* tree or Hybrid A* expansions',''],
  ['<i class="swatch" style="background:var(--muted);opacity:.5"></i>','DWA rollouts; the chosen one is green, rejected ones red',''],
  ['<i class="swatch line" style="border-color:var(--accent)"></i>','Thin line from the robot: carrot point of pure pursuit, PID or DWA, or the projection point of rear-wheel feedback and Stanley','']]},
 {id:'tele',title:'Telemetry',rows:[""")
rep(".nom dd{margin:0;font-size:.86rem;line-height:1.4;min-width:0}",""".nom dd{margin:0;font-size:.86rem;line-height:1.4;min-width:0}
.swatch{display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:middle;font-style:normal}
.swatch.ring{background:transparent;border:2px solid}
.swatch.sq{border-radius:2px;width:9px;height:9px}
.swatch.dia{border-radius:1px;width:10px;height:10px;transform:rotate(45deg)}
.swatch.line{width:22px;height:0;border-radius:0;border-top:3px solid}
.swatch.line.dash{border-top-style:dashed}""")
