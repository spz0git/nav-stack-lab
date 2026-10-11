
/* ============================================================
   UI: levels, tabs, params
   ============================================================ */
const TABS=[
 {id:'loc',n:'1',name:'Localize'},{id:'per',n:'2',name:'Perceive'},{id:'mis',n:'3',name:'Mission'},{id:'plan',n:'4',name:'Plan'},{id:'ctl',n:'5',name:'Control'},
 {id:'veh',n:'',name:'Vehicle'},{id:'code',n:'',name:'Code'},{id:'exp',n:'',name:'Experiments'},{id:'view',n:'',name:'Layers'},{id:'sym',n:'',name:'Symbols'},{id:'learn',n:'',name:'Learn'}];
const mpc_=()=>P.ctl==='mpc',pf_=()=>P.loc==='pf',filt=()=>P.loc==='ekf'||P.loc==='pf';
