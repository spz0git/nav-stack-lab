# MPC: new commands build on the last issued command (Δu form), not on the measured actuator state
rep("  if(M.lag)x0.push(S.cmd.v||0,car?(S.cmd.steer||0):(S.cmd.w||0));",
    "  const LC=S.cmdIssued||S.cmd;   // last command this controller issued\n  if(M.lag)x0.push(LC.v||0,car?(LC.steer||0):(LC.w||0));")
rep("  const bv=M.lag?x0[5]:x0[3],bs=M.lag?x0[6]:x0[4],vc=bv+u0[0]*DT,sc=bs+u0[1]*DT;",
    "  const bv=LC.v||0,bs=car?(LC.steer||0):(LC.w||0),vc=bv+u0[0]*DT,sc=bs+u0[1]*DT;   // u = u_prev + u̇·T")
rep("function applyCmd(c){const n=Math.round(P.latency/DT);","function applyCmd(c){S.cmdIssued=c;const n=Math.round(P.latency/DT);")
