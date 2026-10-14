/* ============================================================
   Timeline (7.2): one time cursor for the whole page. The track under the map spans the recorded frames of the
   current run (10 Hz, up to 5 minutes) with the run's events as marks. Dragging it, clicking the plot or an event
   log line pauses and replays that moment: map, status strip, plot and log all show it. Hovering the track or the
   plot shows a time cursor in the plot and the robot at that time on the map. Run or Step continues from the live state.
   ============================================================ */
const REPLAY={active:false,i:0};
const CURSOR={hover:null};   // hovered time [s] on the track or the plot, or null
function replayFrame(){return REPLAY.active&&REC.frames.length?REC.frames[clamp(REPLAY.i,0,REC.frames.length-1)]:null;}
// the time the page is showing: the replayed frame's, or the live one
function shownT(){const f=replayFrame();return f?f.t:S?S.t:0;}
function frameAt(t){const F=REC.frames;let lo=0,hi=F.length-1;if(hi<0)return-1;while(lo<hi){const m=(lo+hi)>>1;if(F[m].t<t)lo=m+1;else hi=m;}return lo>0&&Math.abs(F[lo-1].t-t)<Math.abs(F[lo].t-t)?lo-1:lo;}
function drawMaybeReplay(){
  const f=replayFrame();if(!f){draw();return;}
  const live=S;S=frameView(f);try{draw();}finally{S=live;}
}
// Jump to a time: pause, replay the nearest recorded frame
function seekTime(t){
  const i=frameAt(t);if(i<0)return;
  running=false;REPLAY.active=true;REPLAY.i=i;logDirty=true;
  syncScrub();drawMaybeReplay();drawPlot();refreshAll();
}
function seekFrame(i){const n=REC.frames.length;if(!n)return;seekTime(REC.frames[clamp(i,0,n-1)].t);}
function exitReplay(){if(REPLAY.active){REPLAY.active=false;logDirty=true;syncScrub();draw();drawPlot();refreshAll();}}
// Event marks: what a log line means for the timeline
const TL_KINDS=[[/^(Plan|Replan)\b/,'plan','plan'],[/^Reached goal|^Mission complete/,'goal','goal'],[/Collision|walked into|contact/i,'contact','contact'],
  [/kidnapped|Scattered|Relocali[sz]ed|Position σ/,'loc','localization'],[/no path|Skipping goal|Speed planner|stuck/i,'warn','warning']];
function tlKind(msg){for(const[re,k,name]of TL_KINDS)if(re.test(msg))return[k,name];return null;}
let tlKey='';
function syncScrub(){
  const sc=$('#scrub');if(!sc||!S)return;const F=REC.frames,n=F.length;
  sc.dataset.state=n<2?'empty':REPLAY.active?'replay':running?'live-running':'live';
  const r=$('#scrubr');r.max=Math.max(0,n-1);r.disabled=n<2;
  if(!REPLAY.active)r.value=Math.max(0,n-1);else r.value=clamp(REPLAY.i,0,n-1);
  const f=n?F[REPLAY.active?clamp(REPLAY.i,0,n-1):n-1]:null,tEnd=n?F[n-1].t:0;
  $('#scrubt').textContent=n<2?'no recording yet':REPLAY.active?`${f.t.toFixed(1)} / ${tEnd.toFixed(1)} s · replay`:`${S.t.toFixed(1)} s · live`;
  $('#scrub-live').hidden=!REPLAY.active;
  // marks: redrawn when the log or the recorded span changes
  const t0=n?F[0].t:0,span=Math.max(1e-6,tEnd-t0),key=S.log.length+'|'+(S.log[0]&&S.log[0].t)+'|'+t0.toFixed(1)+'|'+tEnd.toFixed(0);
  if(key!==tlKey){tlKey=key;
    $('#tl-marks').innerHTML=n<2?'':S.log.map(l=>{const k=tlKind(l.msg);if(!k||l.t<t0-1e-6||l.t>tEnd+1e-6)return'';return`<i class="tl-m ${k[0]}" style="left:${(100*(l.t-t0)/span).toFixed(2)}%" title="${l.t.toFixed(1)} s · ${esc(l.msg)}"></i>`;}).join('');}
}
{const r=$('#scrubr');
 r.oninput=e=>{seekFrame(+e.target.value);};
 // , and . step one frame (0.1 s); Home/End go to the start and back to live
 r.addEventListener('keydown',e=>{if(e.key==='End'){e.preventDefault();exitReplay();}});
 $('#scrub-live').onclick=exitReplay;
 const tr=$('#tl-track');
 tr.addEventListener('pointermove',e=>{const F=REC.frames;if(F.length<2)return;const b=r.getBoundingClientRect(),u=clamp((e.clientX-b.left)/b.width,0,1);
   CURSOR.hover=F[0].t+u*(F[F.length-1].t-F[0].t);tr.title=`${CURSOR.hover.toFixed(1)} s`;hoverChanged();});
 tr.addEventListener('pointerleave',()=>{CURSOR.hover=null;hoverChanged();});}
document.addEventListener('keydown',e=>{
  const t=e.target,tag=t&&t.tagName;if(tag==='INPUT'&&t.type!=='range'||tag==='TEXTAREA'||tag==='SELECT'||e.metaKey||e.ctrlKey||e.altKey)return;
  if(e.key===','||e.key==='.'){const n=REC.frames.length;if(n<2||AN.mode!=='sim')return;e.preventDefault();seekFrame((REPLAY.active?REPLAY.i:n-1)+(e.key==='.'?1:-1));}
});
// A hover elsewhere on the page (track or plot) redraws the plot cursor and the robot at that time on the map
let hoverQ=0;
function hoverChanged(){if(!hoverQ)hoverQ=requestAnimationFrame(()=>{hoverQ=0;if(AN.mode!=='sim'||!S)return;drawMaybeReplay();drawPlot();renderValues();});}
// the robot (true pose) and the estimate at the hovered time, drawn faintly on the map
function drawHoverGhost(px){
  if(CURSOR.hover==null||!REC.frames.length)return;const f=REC.frames[frameAt(CURSOR.hover)];if(!f)return;
  ctx.save();ctx.globalAlpha=0.38;robotShape(f.est.x,f.est.y,f.est.th,false,px);robotShape(f.robot.x,f.robot.y,f.robot.th,true,px);ctx.restore();
}
