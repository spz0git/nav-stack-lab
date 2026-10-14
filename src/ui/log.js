/* ---------- event log rendering ---------- */
// Each line seeks the timeline to its time; while replaying, lines after the shown moment are dimmed
function renderLog(){
  if(!logDirty)return;logDirty=false;
  const tc=REPLAY.active?shownT():Infinity;
  $('#log').innerHTML=S.log.map(l=>`<li class="${l.cls}${l.t>tc+1e-6?' later':''}" data-t="${l.t}" title="Show this moment (${l.t.toFixed(1)} s)"><span>${l.t.toFixed(1)}s</span>${esc(l.msg)}</li>`).join('');
}
$('#log').addEventListener('click',e=>{const li=e.target.closest('li[data-t]');if(li&&REC.frames.length>1)seekTime(+li.dataset.t);});
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
