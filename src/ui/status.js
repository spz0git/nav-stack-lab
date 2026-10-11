
/* ---------- status & metrics ---------- */
const STATE_CLS={IDLE:'idle',PLAN:'plan',DRIVE:'drive',NO_PATH:'bad',DONE:'done',LOST:'warn'};
function renderStatus(){
  const F=S.fsm,r=S.robot,e=S.est,ep=hyp(r.x-e.x,r.y-e.y),done=WPS.filter(w=>w.done).length;
  const ready=!running&&S.t===0&&(F.state==='DRIVE'||F.state==='PLAN');
  const st=F.state==='IDLE'&&WPS.length===0?'IDLE · tap the map to add goals':ready?'READY':F.state.replace('_',' ');
  $('#status').innerHTML=`<span class="pill ${ready?'ready':STATE_CLS[F.state]}">${st}</span>
   <span class="kv">t <b>${S.t.toFixed(1)} s</b></span>
   <span class="kv">goals <b>${done}/${WPS.length}</b></span>
   <span class="kv">pose error <b class="${ep>0.5?'bad':''}">${ep.toFixed(2)} m</b></span>
   <span class="kv">collisions <b class="${S.coll+S.collPed?'bad':''}">${S.coll+S.collPed}</b></span>${isCar()?`
   <span class="kv">gear <b>${r.v<-0.01?'R':r.v>0.01?'D':'–'}</b> · steer <b>${deg(r.d).toFixed(0)}°</b></span>`:''}`;
  $('#run').textContent=running?'Pause':'Run';
}
function renderMetrics(){
  const r=S.robot,e=S.est,ep=hyp(r.x-e.x,r.y-e.y);
  const nees=S.nees.length?S.nees.reduce((a,b)=>a+b,0)/S.nees.length:null;
  const ps=S.planStats;
  const items=[
    ['Distance',`${S.dist.toFixed(1)} m`],
    ['Collisions',`${S.coll} static, ${S.collPed} people${S.collPedStill?` (${S.collPedStill} into the stopped robot)`:''}`],
    ['Pose error',`${ep.toFixed(2)} m · ${deg(Math.abs(wrap(r.th-e.th))).toFixed(1)}°`],
    ['Pose RMS',S.errN?`${Math.sqrt(S.errSq/S.errN).toFixed(2)} m`:'—'],
    ['NEES (3 = consistent)',nees==null?'—':`${nees.toFixed(1)}${nees>7.8?' · overconfident':''}`],
    ['Cross-track RMS',S.cteN?`${Math.sqrt(S.cteSq/S.cteN).toFixed(3)} m`:'—'],
    ['Last plan',ps?`${ps.name} · ${ps.len.toFixed(1)} m${ps.extra?' · '+ps.extra:''} · ${ps.ms.toFixed(0)} ms`:'—'],
    ['Search effort',ps&&ps.exp?`${ps.exp} ${ps.name==='RRT*'?'tree nodes':'expansions'}`:'—'],
  ];
  if(P.ctl==='mpc'&&S.mpcStats){const m=S.mpcStats;items.push(['MPC solve',`${m.mode} · ${m.ms.toFixed(1)} ms · ${m.it} it · J ${m.J.toFixed(1)}`],['MPC violation',m.viol>0.005?`${m.viol.toFixed(3)}`:'none']);}
  if(S.peds.length)items.push(['Closest to a person',isFinite(S.minPed)?`${Math.max(0,S.minPed).toFixed(2)} m`:'—']);
  if(S.agents&&agOn()){const tr=S.agents.tracks,cf=tr.filter(t=>t.conf).length;items.push(['Agent tracks',`${cf} confirmed · ${tr.length-cf} tentative`]);}
  if(S.slam)items.push(['SLAM map',`${S.slam.n} of ${S.beacons.length} beacons · ${(3+2*S.slam.n)} states`]);
  if(S.pf)items.push(['Particles',`N_eff ${S.pf.neff.toFixed(0)}/${S.pf.N}, inj ${(S.pf.inj*100).toFixed(0)}%`]);
  if(P.assoc==='unknown'&&P.loc!=='truth'&&P.loc!=='dr')items.push(['Gated measurements',String(S.rejected)]);
  $('#metrics').innerHTML=items.map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
}
