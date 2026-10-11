rep("let activeTab='loc';const howOpen={};",r"""let activeTab='loc';const howOpen={};
// Show a Symbols group: scroll only the console on desktop (below its sticky tabs), the page on phones
function showSym(id){activeTab='sym';buildTabs();renderAllPanes();
  const el=document.getElementById('sym-'+id),c=document.querySelector('.console');if(!el)return;
  if(c.scrollHeight>c.clientHeight+1&&getComputedStyle(c).overflowY!=='visible'){const tb=c.querySelector('.tabs').offsetHeight;
    c.scrollTop+=el.getBoundingClientRect().top-c.getBoundingClientRect().top-tb-8;}
  else el.scrollIntoView({block:'start'});}""")
rep("pane.querySelectorAll('[data-sym]').forEach(b=>b.onclick=()=>{activeTab='sym';buildTabs();renderAllPanes();const el=document.getElementById('sym-'+b.dataset.sym);if(el)el.scrollIntoView({block:'start'});});",
    "pane.querySelectorAll('[data-sym]').forEach(b=>b.onclick=()=>showSym(b.dataset.sym));")
rep("$('#legendmore').onclick=()=>{activeTab='sym';buildTabs();renderAllPanes();const el=document.getElementById('sym-map');if(el)el.scrollIntoView({block:'start'});};",
    "$('#legendmore').onclick=()=>showSym('map');")
rep(".nom{display:flex;flex-direction:column;gap:6px;scroll-margin-top:52px}",".nom{display:flex;flex-direction:column;gap:6px;scroll-margin-top:12px}")
rep(".ctl-sep{width:1px;align-self:stretch;background:var(--line);margin-inline:4px}",".ctl-sep{width:1px;align-self:stretch;background:var(--line);margin-inline:4px}\n@media (max-width:960px){.ctl-sep{display:none}}")
