# Bumpless transfer: build on the MPC's own last command only if it was applied on the previous tick
rep("  const LC=S.cmdIssued||S.cmd;   // last command this controller issued",
    "  // Δu form: build on this controller's own last command when it ran on the previous tick;\n  // after any interruption (replan tick, controller switch) start again from the measured actuator state\n  const LC=(S.mpcCmd&&S.mpcCmd.tick===S.tick-1)?S.mpcCmd:{v:S.odo.v,steer:S.robot.d,w:S.odo.w};")
rep("  const bv=LC.v||0,bs=car?(LC.steer||0):(LC.w||0),vc=bv+u0[0]*DT,sc=bs+u0[1]*DT;   // u = u_prev + u̇·T",
    "  const bv=LC.v||0,bs=car?(LC.steer||0):(LC.w||0),vc=bv+u0[0]*DT,sc=bs+u0[1]*DT;   // u = u_prev + u̇·T\n  S.mpcCmd={v:vc,steer:car?clamp(sc,-steerMax(),steerMax()):0,w:car?0:clamp(sc,-P.wmax,P.wmax),tick:S.tick};")
