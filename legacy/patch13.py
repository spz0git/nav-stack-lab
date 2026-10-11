# state reset
rep("cmd:{v:0,w:0,steer:0},odo:{v:0,w:0},plan:null,segIdx:0,","cmd:{v:0,w:0,steer:0},odo:{v:0,w:0},plan:null,segIdx:0,mpc:null,mpcStats:null,")
# ---------- UI ----------
rep("opts:()=>[['pp','Pure pursuit'],['rwf','Rear-wheel feedback'],...(isCar()?[['stanley','Stanley']]:[]),['pid',isCar()?'PID steering':'PID heading'],['dwa','DWA'],['custom','Your code']]},",
    "opts:()=>[['pp','Pure pursuit'],['rwf','Rear-wheel feedback'],...(isCar()?[['stanley','Stanley']]:[]),['pid',isCar()?'PID steering':'PID heading'],['dwa','DWA'],['mpc','MPC'],['custom','Your code']]},")
rep("      {k:'dwaT',label:'Rollout horizon',min:0.5,max:3,step:0.1,unit:'s',show:()=>P.ctl==='dwa'}],",
"""      {k:'dwaT',label:'Rollout horizon',min:0.5,max:3,step:0.1,unit:'s',show:()=>P.ctl==='dwa'},
      {k:'mpcMode',type:'seg',label:'MPC formulation',opts:[['nmpc','Nonlinear (NMPC)'],['ltv','Linearized about reference (LTV)']],show:mpc_},
      {k:'mpcNp',label:'Prediction horizon Np',min:3,max:40,step:1,unit:'steps',show:mpc_},
      {k:'mpcNc',label:'Control horizon Nc (free moves, then held)',min:1,max:40,step:1,unit:'steps',show:mpc_},
      {k:'mpcDt',label:'Prediction step Δt',min:0.05,max:0.3,step:0.05,unit:'s',show:mpc_},
      {type:'info',text:()=>{const np=Math.round(P.mpcNp),nc=Math.min(Math.round(P.mpcNc),np);return`Looks ${(np*P.mpcDt).toFixed(1)} s ahead with ${nc} free input move${nc>1?'s':''} (${(nc*P.mpcDt).toFixed(1)} s); ${2*nc} decision variables.${P.mpcNc>P.mpcNp?' Nc is capped at Np.':''}`;},show:mpc_},
      {k:'mpcIt',label:'SQP iterations per tick',min:1,max:10,step:1,show:()=>mpc_()&&P.mpcMode==='nmpc'},
      {k:'mpcQlat',label:'Weight: lateral error',min:0,max:100,step:1,show:mpc_},
      {k:'mpcQlon',label:'Weight: along-track error',min:0,max:50,step:0.5,show:mpc_},
      {k:'mpcQth',label:'Weight: heading error',min:0,max:50,step:0.5,show:mpc_},
      {k:'mpcQv',label:'Weight: speed error',min:0,max:20,step:0.5,show:mpc_},
      {k:'mpcQf',label:'Terminal weight multiplier',min:1,max:30,step:1,unit:'×',show:mpc_},
      {k:'mpcRa',label:'Input weight: acceleration',min:0,max:5,step:0.05,show:mpc_},
      {k:'mpcRs',label:'Input weight: steering rate (car) / angular accel',min:0,max:5,step:0.05,show:mpc_},
      {k:'mpcRd',label:'Input change weight (Δu between moves)',min:0,max:10,step:0.1,show:mpc_},
      {k:'mpcRho',label:'Constraint penalty ρ (augmented Lagrangian)',min:10,max:1000,step:10,show:mpc_},
      {k:'mpcObs',type:'bool',label:'Obstacle constraints from lidar (nonconvex, NMPC only)',show:()=>mpc_()&&P.mpcMode==='nmpc'},
      {k:'mpcMarg',label:'Obstacle margin',min:0,max:0.5,step:0.01,unit:'m',show:()=>mpc_()&&P.mpcMode==='nmpc'&&P.mpcObs},
      {k:'mpcLag',type:'bool',label:'Include actuator lag τ in the prediction model (adds 2 states)',show:mpc_},
      {type:'info',text:()=>`Input bounds come from Vehicle: |a| ≤ ${(P.accel?P.amax:3).toFixed(2)} m/s², ${isCar()?`|δ̇| ≤ ${P.steerRate.toFixed(1)} rad/s`:`|α| ≤ ${(P.accel?P.alpha:8).toFixed(1)} rad/s²`}. ${P.accel?'':'Acceleration limits are off, so the model assumes 3 m/s². '}${P.mpcLag&&!(P.lag>0)?'Lag τ is 0 in Vehicle, so the lag model is inactive.':''}`,show:mpc_}],""")
rep("const pf_=()=>P.loc==='pf',","const mpc_=()=>P.ctl==='mpc',pf_=()=>P.loc==='pf',")
rep("{k:'vcruise',label:'Cruise speed',min:0.2,max:2,step:0.05,unit:'m/s',show:()=>P.ctl!=='custom'},","{k:'vcruise',label:'Cruise speed (reference profile)',min:0.2,max:2,step:0.05,unit:'m/s',show:()=>P.ctl!=='custom'},")
rep("show:()=>P.ctl==='pp'||P.ctl==='stanley'||P.ctl==='rwf'},","show:()=>P.ctl==='pp'||P.ctl==='stanley'||P.ctl==='rwf'||P.ctl==='mpc'},")
rep("{pp:'pure pursuit',rwf:'rear-wheel feedback',pid:'PID',dwa:'DWA',stanley:'Stanley',custom:'your code'}","{pp:'pure pursuit',rwf:'rear-wheel feedback',pid:'PID',dwa:'DWA',stanley:'Stanley',mpc:'MPC',custom:'your code'}")
rep("['dwa','DWA rollouts']];","['dwa','Local planner: DWA rollouts, MPC prediction and reference']];")
# metrics
rep("  if(S.pf)items.push(['Particles',","  if(P.ctl==='mpc'&&S.mpcStats){const m=S.mpcStats;items.push(['MPC solve',`${m.mode} · ${m.ms.toFixed(1)} ms · ${m.it} it · J ${m.J.toFixed(1)}`],['MPC max violation',m.viol>0.005?`${m.viol.toFixed(3)}`:'none']);}\n  if(S.pf)items.push(['Particles',")
# draw prediction
rep("  if(LAYERS.dwa&&S.ctlViz&&S.ctlViz.trajs){",
"""  if(LAYERS.dwa&&S.ctlViz&&S.ctlViz.pred){const V=S.ctlViz;
    ctx.fillStyle=TOK.accent;for(const p of V.ref){ctx.beginPath();ctx.arc(p[0],p[1],px(2.2),0,TAU);ctx.fill();}
    if(V.lin){ctx.strokeStyle=TOK.rose;ctx.lineWidth=px(2);ctx.setLineDash([px(4),px(3)]);polyline(V.lin);ctx.stroke();ctx.setLineDash([]);}
    ctx.strokeStyle=TOK.ok;ctx.lineWidth=px(2.5);polyline(V.pred);ctx.stroke();
    ctx.fillStyle=TOK.ok;for(let i=0;i<V.pred.length;i++){const p=V.pred[i];ctx.beginPath();ctx.arc(p[0],p[1],px(1.8),0,TAU);ctx.fill();}}
  if(LAYERS.dwa&&S.ctlViz&&S.ctlViz.trajs){""")
rep("""        <span><i class="disc" style="background:var(--warn)"></i>people</span>""","""        <span><i class="disc" style="background:var(--warn)"></i>people</span>
        <span><i style="border-color:var(--ok)"></i>MPC prediction (LTV: dashed = linear model)</span>""")
# notes
rep("""<p><b>Car-like model.</b> Pure pursuit outputs steering directly.""","""<p><b>MPC</b> solves a finite-horizon optimal control problem every 50 ms and applies only the first move.</p>
<div class="eq">state  x = [x, y, θ, v, s]   s = ω (diff-drive) or δ (car)   (+ [v_cmd, s_cmd] if lag is modelled)
input  u = [a, ṡ]           so |a| ≤ a_max and |ṡ| ≤ rate limit are exact box constraints
model  θ_mid = θ + ½ω Δt,  x⁺ = x + v cos θ_mid Δt, …,  ω = v tan δ / L for the car

min  Σ_{k=1..Np} w_k (Q_lon e_lon² + Q_lat e_lat² + Q_θ e_θ² + Q_v e_v²)        w_Np = terminal ×
   + Σ_{k=0..Np−1} (R_a a_k² + R_s ṡ_k²) + R_Δ Σ_{k<Nc} ‖u_k − u_{k−1}‖²
s.t. u_k = u_{Nc−1} for k ≥ Nc (control horizon)
     |s| ≤ s_max, speed sign and limit per leg, footprint clearance ≥ margin  (augmented Lagrangian)</div>
<p><b>Solver.</b> Single-shooting Gauss–Newton SQP. Each iteration rolls the model out, computes sensitivities ∂x_k/∂U from the Jacobians A_k and B_k, builds H = JᵀJ and g = Jᵀr over the 2·Nc decision variables, and solves the box-constrained QP by projected Newton. A backtracking line search on the true cost follows, then a multiplier update. It is warm-started from the previous solution shifted by one tick, which is the real-time-iteration idea.</p>
<p><b>NMPC</b> relinearizes about its own rollout every iteration, so it stays valid far from the path and can take nonconvex obstacle constraints. <b>LTV</b> linearizes once about the reference trajectory and predicts with that linear model, which makes it one convex QP. On the map, LTV's linear prediction is dashed and what those inputs really do is solid. The two separate when heading error is large.</p>
<p><b>Horizons.</b> Np is how far the model looks ahead. Nc is how many independent moves it may choose. Small Nc means fewer variables and smoother, less agile control. Nc = 1 is a single held command.</p>
<p><b>Car-like model.</b> Pure pursuit outputs steering directly.""")
# tries
rep("""         '<b>Vehicle:</b> turn on acceleration limits and set lag τ to 0.3 s. The speed plot shows command and response diverge.'],""",
"""         '<b>Vehicle:</b> turn on acceleration limits and set lag τ to 0.3 s. The speed plot shows command and response diverge.',
         '<b>Control:</b> MPC. Compare cross-track RMS with pure pursuit. Shrink Np to 3 (myopic) and Nc to 1 (one held move). With lag τ = 0.3 s, tick Include actuator lag and compare.'],""")
rep("""         '<b>Control:</b> tune DWA clearance weight. Too low clips people, too high stalls in narrow aisles.',""",
"""         '<b>Control:</b> tune DWA clearance weight. Too low clips people, too high stalls in narrow aisles.',
         '<b>Control:</b> MPC with obstacle constraints versus DWA. The MPC respects the acceleration limits exactly. Tick Include actuator lag, since τ = 0.15 s here.',""")
rep("""         '<b>Localize:</b> switch to EKF and raise odometry noise. The log reports the true final pose error at every bay.'],""",
"""         '<b>Localize:</b> switch to EKF and raise odometry noise. The log reports the true final pose error at every bay.',
         '<b>Control:</b> MPC knows the steering-rate limit, so it needs no dry-steering rule at cusps. Switch it to LTV and watch the dashed linear prediction drift from the true one at the start of each leg.'],""")
rep("const old=P[k];P[k]=v;if(old===v&&!['infl',","const old=P[k];P[k]=v;if(k.startsWith('mpc')&&S)S.mpc=null;if(old===v&&!['infl',")
