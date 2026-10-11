rep("const c=clearAt(nx,ny,nt),need=(lenient&&hyp(nx-e.x,ny-e.y)<1.0)?Math.min(MARG,startClear-0.02):MARG;",
    "const c=clearAt(nx,ny,nt),need=(lenient&&hyp(nx-e.x,ny-e.y)<1.0)?Math.min(MARG,startClear-0.1):MARG;   // let a car that is touching something back out")
rep("         '<b>Control:</b> the default is rear-wheel feedback (curvature feedforward).",
    "         '<b>Control:</b> DWA follows the plan into a bay but stops short. It scores distance to a carrot, not the final pose, so it is a local avoider rather than a parking controller.',\n         '<b>Control:</b> the default is rear-wheel feedback (curvature feedforward).")
rep("'<b>Plan:</b> set the heuristic to 2D only and compare expansions in the log.',",
    "'<b>Plan:</b> set the heuristic to 2D only and compare expansions in the log. Then raise Steering used by the planner to 100%: full-lock arcs leave the tracker no room to correct.',")
