let symQuery='',symGroup='';
function symPane(){
  return`<p class="note">Notation follows the usual IEEE style. Some letters are reused between subsystems, as in the literature (for example ${I('g')}, ${I('H')}, ${I('S')}, ${I('J')}, ${I('k')}, α and ${I('s')}). The group heading tells you which meaning applies. SI units; angles in radians unless a panel shows degrees.</p>
  <input class="symsearch" id="symq" type="search" placeholder="Search symbols and definitions…" value="${esc(symQuery)}" aria-label="Search symbols">
  <div class="symchips"><button data-g="" aria-pressed="${symGroup===''}">All</button>${NOMEN.map(g=>`<button data-g="${g.id}" aria-pressed="${symGroup===g.id}">${g.title}</button>`).join('')}</div>`+
    NOMEN.map(g=>`<section class="nom" id="sym-${g.id}"><h3>${g.title}</h3><dl>${g.rows.map(([sy,d,u])=>`<dt>${sy}</dt><dd>${d}${u?` <span class="unit">[${u}]</span>`:''}</dd>`).join('')}</dl></section>`).join('');
}
function symFilter(){
  const q=symQuery.trim().toLowerCase();
  document.querySelectorAll('#pane .nom').forEach(sec=>{const gid=sec.id.slice(4);let any=false;const dts=sec.querySelectorAll('dt');
    dts.forEach(dt=>{const dd=dt.nextElementSibling,txt=(dt.textContent+' '+dd.textContent).toLowerCase(),show=(!symGroup||symGroup===gid)&&(!q||txt.includes(q));dt.classList.toggle('hidden',!show);dd.classList.toggle('hidden',!show);if(show)any=true;});
    sec.classList.toggle('hidden',!any);});
}
function wireSym(pane){
  const q=$('#symq');if(q){q.oninput=()=>{symQuery=q.value;symFilter();};}
  pane.querySelectorAll('.symchips button').forEach(b=>b.onclick=()=>{symGroup=b.dataset.g;pane.querySelectorAll('.symchips button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));symFilter();});
  symFilter();
}
function layersPane(){
  const L=[['ghost','True-map outline over the built map'],['cost','Costmap inflation'],['search','Planner search (A* closed set / RRT* tree)'],['lidar','Lidar hits (as perceived)'],['beam','Beacon measurements (from the estimate)'],['belief','Particles / 95% covariance ellipse'],['trail','Trails (solid = truth, dashed = estimate)'],['dwa','Local planner: DWA rollouts, MPC prediction and reference'],['agents','Agent tracks, predictions, and the ego\'s predicted positions at the same times'],['ghostrun','Previous run on this level: ghost trail on the map and ghost series in the plot']];
  return`<p class="note">What to draw on the map. Nothing here changes the simulation.</p>`+L.map(([k,l])=>`<label class="check"><input type="checkbox" id="layer-${k}" data-layer="${k}" ${LAYERS[k]?'checked':''}><span>${l}</span></label>`).join('')+(GHOST?`<p class="note">Ghost: ${esc(GHOST.label)} (${GHOST.t.toFixed(0)} s). <button class="linkbtn" id="ghost-clear" type="button">Forget it</button></p>`:'');
}
let codeSlot='ctl';
function codePane(){
  const sl=SLOTS[codeSlot],D=SLOT_DEFS[codeSlot];
  const blurb={ctl:'A path tracker: called every 50 ms while the robot drives a leg. It sees the estimated pose, odometry, the planned path, lidar points and the agent tracks, and returns speed and steering.',
    plan:'A global planner: called when the mission needs a path. It gets the costmap grid, the start and the goal, and returns a path (or reverse legs for the car).',
    loc:'A localizer: called every tick with odometry and the sensor readings of that tick, and returns the pose estimate the rest of the stack uses.',
    pred:'An agent predictor: called at 10 Hz with the confirmed tracks and returns each one\'s predicted trajectory, which the speed planner, DWA and MPC then avoid.'}[codeSlot];
  return`<div class="field"><span class="lbl">Slot</span><div class="seg" id="codeslot">${Object.keys(SLOT_DEFS).map(k=>`<button data-v="${k}" aria-pressed="${k===codeSlot}">${SLOT_DEFS[k].name}${SLOTS[k].worker?' ●':''}</button>`).join('')}</div></div>
  <p class="note">${blurb} It runs in a sandboxed Web Worker in lockstep with the simulation, with a ${D.timeout} ms budget per call.</p>
  <textarea id="code" spellcheck="false" aria-label="${D.name} code">${esc(sl.code)}</textarea>
  <div class="controls"><button class="btn primary" id="loadcode">Load and use</button><button class="btn" id="resetcode">Restore example</button><button class="btn" id="viewsrc" data-src="${codeSlot}">Built-in source</button></div>
  <p class="codestat ${sl.status.cls}" id="codestat">${esc(sl.status.msg)}</p>`;
}
function setCodeStatus(msg,cls){slotStatus(codeSlot,msg,cls);}
UI.slotStatus=(k,msg,cls)=>{if(k!==codeSlot)return;const el=$('#codestat');if(el){el.textContent=msg;el.className='codestat '+cls;}};
function wireCode(){
  const ta=$('#code');if(!ta)return;
  ta.oninput=()=>{SLOTS[codeSlot].code=ta.value;};
  ta.onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();const s=ta.selectionStart;ta.setRangeText('  ',s,ta.selectionEnd,'end');SLOTS[codeSlot].code=ta.value;}};
  $('#codeslot').querySelectorAll('button').forEach(b=>b.onclick=()=>{codeSlot=b.dataset.v;renderAllPanes();});
  $('#loadcode').onclick=()=>{if(slotLoad(codeSlot,ta.value)){logE(`Loaded your ${SLOT_DEFS[codeSlot].name.toLowerCase()} code`);renderAllPanes();refreshAll();}};
  $('#resetcode').onclick=()=>{const ex=codeSlot==='ctl'?DEFAULT_CODE:SLOT_EXAMPLES[codeSlot];SLOTS[codeSlot].code=ex;ta.value=ex;};
  $('#viewsrc').onclick=()=>showSource({ctl:'core/controllers.js',plan:'core/planning.js',loc:'core/localization.js',pred:'core/agents.js'}[codeSlot]);
}
