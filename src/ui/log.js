/* ---------- event log rendering ---------- */
function renderLog(){
  if(!logDirty)return;logDirty=false;
  $('#log').innerHTML=S.log.map(l=>`<li class="${l.cls}"><span>${l.t.toFixed(1)}s</span>${esc(l.msg)}</li>`).join('');
}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
