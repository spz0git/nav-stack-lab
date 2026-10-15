/* ============================================================
   Workspace (7.1): the map fills the stage; a telemetry dock under it and the panel on the right can be resized
   (drag the splitters, or focus one and use the arrow keys) and hidden. Sizes are remembered in this browser only.
   ============================================================ */
const WS={insp:null,dock:220,inspOff:false,dockOff:false,preset:'tune'};
const WS_KEY='nav-stack-lab.layout';
try{const s=JSON.parse(localStorage.getItem(WS_KEY)||'null');if(s&&typeof s==='object'){for(const k of Object.keys(WS))if(k in s)WS[k]=s[k];if(typeof s.brief==='boolean')briefOpen=s.brief;}}catch(_){}
function wsSave(){try{localStorage.setItem(WS_KEY,JSON.stringify({...WS,brief:briefOpen}));}catch(_){}}
const wideUI=()=>matchMedia('(min-width:961px) and (min-height:600px)').matches;
function wsApply(){
  const lay=$('.layout');
  if(WS.insp)lay.style.setProperty('--insp-w',WS.insp+'px');else lay.style.removeProperty('--insp-w');
  lay.style.setProperty('--dock-h',WS.dock+'px');
  lay.classList.toggle('insp-off',WS.inspOff);
  $('#dock').classList.toggle('folded',WS.dockOff);
  $('#tg-insp').setAttribute('aria-pressed',String(!WS.inspOff));
  $('#tg-dock').setAttribute('aria-pressed',String(!WS.dockOff));
  const f=$('#dock-fold');f.setAttribute('aria-expanded',String(!WS.dockOff));f.textContent=WS.dockOff?'▴':'▾';f.title=WS.dockOff?'Open the dock':'Fold the dock to its header';
}
// a taller dock when plots are added (desktop), up to what leaves the map about 300 px
function wsEnsureDock(h){if(!wideUI())return;if(WS.dockOff)WS.dockOff=false;if(WS.dock<h){const st=$('#simview').getBoundingClientRect().height;WS.dock=Math.round(Math.max(WS.dock,Math.min(h,st-420)));}wsApply();wsSave();}
function wsInspector(on){WS.inspOff=!on;wsApply();wsSave();}
function wsDock(on){WS.dockOff=!on;wsApply();wsSave();}
vmMark();
$('#tg-insp').onclick=()=>wsInspector(WS.inspOff);
$('#tg-dock').onclick=()=>wsDock(WS.dockOff);
$('#dock-fold').onclick=()=>wsDock(WS.dockOff);
// Splitters: pointer drag, double-click to hide or fold, arrow keys to resize, Enter to hide or fold
function wsSplitter(el,{size,set,toggle}){
  let drag=null;
  el.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();drag={p0:el.getAttribute('aria-orientation')==='vertical'?e.clientX:e.clientY,s0:size()};el.setPointerCapture(e.pointerId);el.classList.add('drag');});
  el.addEventListener('pointermove',e=>{if(!drag)return;const p=el.getAttribute('aria-orientation')==='vertical'?e.clientX:e.clientY;set(drag.s0-(p-drag.p0));});
  const end=()=>{if(!drag)return;drag=null;el.classList.remove('drag');wsSave();};
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
  el.addEventListener('dblclick',toggle);
  el.addEventListener('keydown',e=>{const d={ArrowLeft:24,ArrowUp:24,ArrowRight:-24,ArrowDown:-24}[e.key];
    if(d){e.preventDefault();set(size()+d);wsSave();}else if(e.key==='Enter'){e.preventDefault();toggle();}});
}
wsSplitter($('#insp-split'),{
  size:()=>$('#inspector').getBoundingClientRect().width,
  set:w=>{const L=$('.layout').getBoundingClientRect().width;WS.insp=Math.round(clamp(w,300,Math.max(300,L-460)));wsApply();},
  toggle:()=>wsInspector(false)});
wsSplitter($('#dock-split'),{
  size:()=>WS.dockOff?44:$('#dock').getBoundingClientRect().height,
  set:h=>{const st=$('#simview').getBoundingClientRect().height;WS.dockOff=false;WS.dock=Math.round(clamp(h,120,Math.max(120,st-300)));wsApply();},
  toggle:()=>wsDock(WS.dockOff)});
// Learn lives in the panel, so opening Learn shows it
$('#modesel').addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.dataset.v==='learn'&&WS.inspOff)wsInspector(true);});
// Canvases follow their panels (splitters and folding change sizes without a window resize)
{let q=0;const redraw=()=>{q=0;if(AN.mode==='an'){if(!$('#anview').hidden)renderAnalysis();}else if(S){draw();drawPlot();}};
 const ro=new ResizeObserver(()=>{if(!q)q=requestAnimationFrame(redraw);});
 ro.observe($('.mapwrap'));ro.observe($('#plotcol'));ro.observe($('.stage'));}
wsApply();
