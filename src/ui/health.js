/* ============================================================
   Health (7.6): one light per subsystem under the status strip, each with the reason in words (Foxglove's
   diagnostics, RViz's display status). Green: working as intended. Amber: degraded. Red: failing. Grey: idle or off.
   Computed in the page from what the run records (no new simulation state); while the timeline replays, from the
   recorded frame where it can. A light turning amber or red marks the timeline.
   ============================================================ */
const HEALTH={ev:[],prev:{},S:null,lastZ:0};
const H_SYS=[['loc','Localize'],['per','Perceive'],['plan','Plan'],['ctl','Control']];
const H_RANK={idle:0,ok:1,warn:2,bad:3};
// [level, reason] for each subsystem, from the live state or a recorded frame f
function healthNow(f){
  const V=f||S,r=V.robot,F=V.fsm,st=F.state,drive=st==='DRIVE',sig=f?f.sig||{}:null,H={};
  // localization
  {const sp=V.Pc?Math.sqrt(Math.max(0,V.Pc[0]+V.Pc[4])):null,nees=sig?sig.nees:S.nees.length?S.nees.slice(-25).reduce((a,b)=>a+b,0)/Math.min(25,S.nees.length):null,
     neff=sig?sig.neff:S.pf?S.pf.neff:null,N=S.pf?S.pf.N:P.npart,usesB=['ekf','pf','slam'].includes(P.loc),silent=usesB&&!f?S.t-HEALTH.lastZ:0;
   if(P.loc==='truth')H.loc=['idle','ground truth: the pose is known'];
   else if(st==='LOST'||sp!=null&&sp>1)H.loc=['bad',`lost: position σ ${sp!=null?sp.toFixed(1):'?'} m`];
   else if(nees!=null&&nees>9)H.loc=['warn',`overconfident: NEES ${nees.toFixed(1)} (3 is consistent)`];
   else if(neff!=null&&P.loc==='pf'&&neff<0.15*N)H.loc=['warn',`particles degenerate: N_eff ${neff.toFixed(0)} of ${N}`];
   else if(silent>3&&drive)H.loc=['warn',`no beacon readings for ${silent.toFixed(1)} s`];
   else if(P.loc==='dr')H.loc=['ok',`dead reckoning${sp!=null?`: σ ${sp.toFixed(2)} m and growing`:''}`];
   else H.loc=['ok',`σ ${sp!=null?sp.toFixed(2):'—'} m${nees!=null?` · NEES ${nees.toFixed(1)}`:''}${neff!=null&&P.loc==='pf'?` · N_eff ${neff.toFixed(0)}`:''}`];}
  // perception
  {const hits=f?(f.scan?f.scan.length/2:0):S.scanPts.length,tr=V.agents?V.agents.tracks:[],cf=tr.filter(t=>t.conf).length,people=V.peds.filter(p=>!p.car).length;
   let gap=Infinity;for(const p of V.peds)gap=Math.min(gap,hyp(r.x-p.x,r.y-p.y)-(p.r||0.3)-RR);
   if(r.pedContact)H.per=['bad','contact with a person'];
   else if(V.t>0.5&&hits===0)H.per=['warn','no lidar returns'];
   else if(agOn()&&cf>people+1)H.per=['warn',`${cf} confirmed tracks for ${people} ${people===1?'person':'people'}: phantom tracks`];
   else if(people&&gap<0.3&&drive)H.per=['warn',`a person ${Math.max(0,gap).toFixed(2)} m away`];
   else if(people&&!agOn())H.per=['idle',`${hits} lidar hits · people not tracked (agent tracking off)`];
   else H.per=['ok',`${hits} lidar hits${agOn()?` · ${cf} track${cf===1?'':'s'}`:''}${P.per==='mapping'?' · mapping':''}`];}
  // mission and plan
  {const ps=S.planStats,skipped=f?f.done.filter(d=>d[1]).length:WPS.filter(w=>w.skipped).length,n=f?f.done.length:WPS.length;
   if(st==='NO_PATH')H.plan=['bad',`no path to the next goal${F.fails?` (attempt ${F.fails} of 3)`:''}`];
   else if(st==='IDLE'&&!n)H.plan=['idle','no goals: tap the map to add some'];
   else if(skipped)H.plan=['warn',`${skipped} goal${skipped===1?'':'s'} skipped`];
   else if(ps&&ps.ms>250&&!f)H.plan=['warn',`last plan took ${ps.ms.toFixed(0)} ms (${ps.name})`];
   else if(st==='DONE')H.plan=['ok','all goals reached'];
   else if(st==='IDLE')H.plan=['idle','ready: press Run'];
   else H.plan=['ok',ps?`${ps.name} · ${ps.len.toFixed(1)} m · ${ps.ms.toFixed(0)} ms`:st.toLowerCase()];}
  // control
  {const D=S.plot,tE=V.t,win=D.filter(d=>d.t>tE-2&&d.t<=tE+1e-6),lim=isCar()?0.97*P.steerMaxDeg:0.97*P.wmax,sat=win.length?win.filter(d=>d.ta!=null&&Math.abs(d.ta)>=lim).length/win.length:0,
     last=win.length?win[win.length-1]:null,cte=last&&last.cte!=null?Math.abs(last.cte):null,mms=sig?sig.mpcMs:S.mpcStats&&P.ctl==='mpc'?S.mpcStats.ms:null;
   if(r.contact)H.ctl=['bad','contact with an obstacle'];
   else if(drive&&sat>0.5)H.ctl=['warn',`${isCar()?'steering':'turn rate'} at its limit ${(sat*100).toFixed(0)} % of the last 2 s`];
   else if(P.ctl==='mpc'&&mms!=null&&mms>=13)H.ctl=['warn',`MPC at its 15 ms budget (${mms.toFixed(1)} ms)`];
   else if(!f&&P.ctl==='mpc'&&S.mpcStats&&S.mpcStats.viol>0.05)H.ctl=['warn',`MPC constraints violated by ${S.mpcStats.viol.toFixed(2)}`];
   else if(drive&&cte!=null&&cte>0.5)H.ctl=['warn',`${cte.toFixed(2)} m off the path`];
   else if(!drive)H.ctl=['idle',st==='DONE'?'stopped: mission complete':'not driving'];
   else H.ctl=['ok',`cross-track ${cte!=null?cte.toFixed(2):'—'} m${mms!=null?` · MPC ${mms.toFixed(1)} ms`:''}`];}
  return H;
}
function renderHealth(){
  const el=$('#health');if(!el||!S)return;
  if(HEALTH.S!==S){HEALTH.S=S;HEALTH.ev=[];HEALTH.prev={};HEALTH.lastZ=0;tlKey='';}
  const f=replayFrame();if(!f&&S.lastZ.length)HEALTH.lastZ=S.t;
  const H=healthNow(f);
  // the moments a light turned amber or red, for the timeline (live only)
  if(!f)for(const[k,name]of H_SYS){const lv=H[k][0],pv=HEALTH.prev[k];if(pv!=null&&H_RANK[lv]>=2&&H_RANK[lv]>H_RANK[pv]){HEALTH.ev.push({t:S.t,sys:k,lvl:lv,msg:`${name}: ${H[k][1]}`});if(HEALTH.ev.length>200)HEALTH.ev.shift();}HEALTH.prev[k]=lv;}
  const html=H_SYS.map(([k,name])=>`<button type="button" class="hl ${H[k][0]}" data-sys="${k}" data-tab="${k}" title="${esc(name)}: ${esc(H[k][1])} (open the ${TAB_NAME[k]} tab)"><i aria-hidden="true"></i><b>${name}</b><span>${esc(H[k][1])}</span></button>`).join('');
  if(el.dataset.h!==html){el.dataset.h=html;el.innerHTML=html;el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(uiMode==='learn')setUIMode(AN.mode);if(WS.inspOff)wsInspector(true);activeTab=b.dataset.tab;consoleOpen=true;buildTabs();renderAllPanes();});}
}
