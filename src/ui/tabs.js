
/* ============================================================
   UI: levels, tabs, params
   ============================================================ */
const TABS=[
 {id:'loc',n:'1',name:'Localize'},{id:'per',n:'2',name:'Perceive'},{id:'mis',n:'3',name:'Mission'},{id:'plan',n:'4',name:'Plan'},{id:'ctl',n:'5',name:'Control'},
 {id:'veh',n:'',name:'Vehicle'},{id:'exp',n:'',name:'Experiments'},{id:'code',n:'',name:'Code'},{id:'view',n:'',name:'Layers'},{id:'sym',n:'',name:'Symbols'}];
const TAB_GROUPS=[{id:'pipe',name:'Pipeline',tabs:['loc','per','mis','plan','ctl','veh']},{id:'tools',name:'Tools',tabs:['exp','code']},{id:'ref',name:'Reference',tabs:['view','sym']}];
const mpc_=()=>P.ctl==='mpc',pf_=()=>P.loc==='pf',filt=()=>P.loc==='ekf'||P.loc==='pf';
