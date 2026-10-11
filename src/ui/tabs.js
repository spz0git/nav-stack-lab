
/* ============================================================
   UI: levels, tabs, params
   ============================================================ */
const TABS=[
 {id:'loc',n:'1',name:'Localize'},{id:'per',n:'2',name:'Perceive'},{id:'mis',n:'3',name:'Mission'},{id:'plan',n:'4',name:'Plan'},{id:'ctl',n:'5',name:'Control'},
 {id:'veh',n:'',name:'Vehicle'},{id:'exp',n:'',name:'Experiments'},{id:'code',n:'',name:'Code'},{id:'view',n:'',name:'Layers'},{id:'sym',n:'',name:'Symbols'}];
// One colour per subsystem, the same as on the map: belief rose, lidar amber, path blue, MPC green (styles.css [data-sys])
const SYS={loc:1,per:1,plan:1,ctl:1};
const TAB_GROUPS=[{id:'pipe',name:'Pipeline',tabs:['loc','per','mis','plan','ctl','veh']},{id:'tools',name:'Tools',tabs:['exp','code']},{id:'ref',name:'Reference',tabs:['view','sym']}];
const mpc_=()=>P.ctl==='mpc',pf_=()=>P.loc==='pf',filt=()=>P.loc==='ekf'||P.loc==='pf';
