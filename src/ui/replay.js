/* ============================================================
   Replay: scrub through the recorded frames of the current run while paused
   ============================================================ */
const REPLAY={active:false,i:0};
function replayFrame(){return REPLAY.active&&REC.frames.length?REC.frames[clamp(REPLAY.i,0,REC.frames.length-1)]:null;}
function drawMaybeReplay(){
  const f=replayFrame();if(!f){draw();return;}
  const live=S;S=frameView(f);try{draw();}finally{S=live;}
}
function syncScrub(){
  const sc=$('#scrub');if(!sc)return;const n=REC.frames.length;
  const show=!running&&n>10&&AN.mode==='sim';sc.hidden=!show;if(!show){REPLAY.active=false;return;}
  const r=$('#scrubr');r.max=n-1;if(!REPLAY.active){r.value=n-1;}
  const f=REC.frames[REPLAY.active?clamp(REPLAY.i,0,n-1):n-1];
  $('#scrubt').textContent=`${f.t.toFixed(1)} s${REPLAY.active?' · replay':' · live'}`;
  $('#scrub-live').hidden=!REPLAY.active;
}
function exitReplay(){if(REPLAY.active){REPLAY.active=false;syncScrub();draw();}}
{const w=document.createElement('div');w.className='scrub';w.id='scrub';w.hidden=true;
 w.innerHTML=`<span class="lbl" title="Drag to review the run. Run or Step continues from the live state.">Replay</span><input type="range" id="scrubr" min="0" max="0" value="0" aria-label="Replay position"><span class="kv" id="scrubt"></span><button class="btn small" id="scrub-live" hidden>Live</button>`;
 const lg=$('.legend');lg.parentNode.insertBefore(w,lg);
 $('#scrubr').oninput=e=>{REPLAY.active=true;REPLAY.i=+e.target.value;syncScrub();drawMaybeReplay();};
 $('#scrub-live').onclick=exitReplay;}
