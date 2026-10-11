rep("const minTurnR=()=>P.wheelbase/Math.tan(steerMax());",
    "const minTurnR=()=>P.wheelbase/Math.tan(steerMax());\nconst planSteer=()=>steerMax()*P.planPct/100, planR=()=>P.wheelbase/Math.tan(planSteer());   // planners keep steering margin for feedback")
rep("rwKth:2.0,rwKe:3.0,","rwKth:2.0,rwKe:3.0,planPct:85,")
rep("const dist=S.cm.dist,L=P.wheelbase,dm=steerMax(),R=minTurnR(),MARG=0.15,","const dist=S.cm.dist,L=P.wheelbase,dm=planSteer(),R=planR(),MARG=0.15,")
rep("  const R=minTurnR(),th=wp.th!=null?wp.th:Math.atan2(wp.y-e.y,wp.x-e.x);","  const R=planR(),th=wp.th!=null?wp.th:Math.atan2(wp.y-e.y,wp.x-e.x);")
rep("function kapAt(sArc){const T=S.track;if(sArc>=T.total||sArc<0)return 0;",
    "function kapAt(sArc){const T=S.track;if(sArc<0)return 0;sArc=Math.min(sArc,T.total-1e-3);   // hold the final curvature up to the cusp\n")
rep("       {k:'eps',label:'Heuristic weight ε',","       {k:'planPct',label:'Steering used by the planner',min:50,max:100,step:5,unit:'% of δ_max',show:()=>isCar()&&(P.plan==='hybrid'||P.plan==='rs')},\n       {type:'info',text:()=>`Planning radius ${planR().toFixed(2)} m (vehicle minimum ${minTurnR().toFixed(2)} m)`,show:()=>isCar()&&(P.plan==='hybrid'||P.plan==='rs')},\n       {k:'eps',label:'Heuristic weight ε',")
rep("const old=P[k];P[k]=v;if(old===v&&!['infl','eps','rrtIt','wheelbase','steerMaxDeg','revPen','gearPen'].includes(k))return;",
    "const old=P[k];P[k]=v;if(old===v&&!['infl','eps','rrtIt','wheelbase','steerMaxDeg','revPen','gearPen','planPct'].includes(k))return;")
rep("if(['wheelbase','steerMaxDeg','revOK','revPen','gearPen','hybH'].includes(k)","if(['wheelbase','steerMaxDeg','revOK','revPen','gearPen','hybH','planPct'].includes(k)")
rep("<p>The two heuristics cover each other's blind spots.","<p><b>Steering margin.</b> Planning at 100% of δ_max produces full-lock arcs. A tracker that starts such an arc slightly off has no steering left to correct with. By default the planners use 85%. Push it to 100% and watch the parking legs fail.</p>\n<p>The two heuristics cover each other's blind spots.")
