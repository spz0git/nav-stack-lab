
/* ---------- main loop ---------- */
function refreshAll(){renderStatus();renderMetrics();renderLog();fsmRefresh();renderSelection();renderLayerPop();renderValues();renderChangedBadge();renderHealth();renderRunsBadge();}
let lastTs=0,acc=0,frame=0;
function loop(ts){
  const dt=Math.min(0.1,(ts-lastTs)/1000||0);lastTs=ts;
  if(running&&!busy){acc+=dt*speed;const n=Math.min(40,Math.floor(acc/DT));if(n>0){acc-=n*DT;advance(n);}}
  else if(!running)acc=0;
  if(AN.mode==='sim'){drawMaybeReplay();if(frame++%3===0){drawPlot();refreshAll();syncScrub();}}
  requestAnimationFrame(loop);
}
{const ex=$('.an-exp'),grid=$('.an-grid');if(ex&&grid)grid.parentNode.insertBefore(ex,grid);}
{const right=document.createElement('div');right.className='right';const ctxEl=$('.ctx'),con=$('.console');ctxEl.parentNode.insertBefore(right,ctxEl);right.appendChild(ctxEl);right.appendChild(con);right.appendChild($('#learnview'));}
const mo=new MutationObserver(()=>{tokKey='';if(AN.mode==='an')renderAnalysis();});mo.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
window.addEventListener('resize',()=>{if(AN.mode==='an')renderAnalysis();else{draw();drawPlot();}});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{tokKey='';if(AN.mode==='an')setTimeout(renderAnalysis,30);});
