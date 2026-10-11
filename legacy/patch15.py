rep("""  const car=isCar(),L=P.wheelbase,lag=P.mpcLag&&P.lag>0,tau=P.lag;
  const f=(x,u,dt)=>{""","""  const car=isCar(),L=P.wheelbase,lag=P.mpcLag&&P.lag>0,tau=P.lag,sMax=car?steerMax():P.wmax;
  const sat=s=>clamp(s,-sMax,sMax);   // the actuator saturates; the model does too
  const f=(x,u,dt)=>{""")
rep("""    if(lag){const a=1-Math.exp(-dt/tau);o[3]=v+(x[5]-v)*a;o[4]=s+(x[6]-s)*a;o.push(x[5]+u[0]*dt,x[6]+u[1]*dt);}
    else{o[3]=v+u[0]*dt;o[4]=s+u[1]*dt;}""","""    if(lag){const a=1-Math.exp(-dt/tau);o[3]=v+(x[5]-v)*a;o[4]=sat(s+(x[6]-s)*a);o.push(x[5]+u[0]*dt,sat(x[6]+u[1]*dt));}
    else{o[3]=v+u[0]*dt;o[4]=sat(s+u[1]*dt);}""")
rep("     |s| ≤ s_max, speed sign and limit per leg, footprint clearance ≥ margin  (augmented Lagrangian)</div>",
    "     speed sign and limit per leg, footprint clearance ≥ margin, |s| ≤ s_max  (augmented Lagrangian;\n     s is also saturated inside the model, as the real actuator is)</div>")
