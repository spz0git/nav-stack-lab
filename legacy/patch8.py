rep("for(const x of[4,6.8,9.5,12.5,15.5])s.push(Rc(x,0.3,1.0,0.56));","for(const x of[4,7.2,9.7,12.5,15.5])s.push(Rc(x,0.3,1.0,0.56));   // 2.2 m parallel slot at x 5.0–7.2")
rep("[15.5,8.35,Math.PI/2],[5.6,0.68,0],[2,13]],","[15.5,8.35,Math.PI/2],[5.8,0.68,0],[2,13]],")
rep("const decelCap=d=>Math.sqrt(2*(P.accel?P.amax:0.8)*Math.max(0,d-0.08));",
    "const decelCap=d=>Math.sqrt(2*(P.accel?P.amax:0.8)*Math.max(0,d-(isCar()?0.02:0.08)))+(isCar()&&d>0.03?0.05:0);   // car creeps to the leg end")
rep("const legDone=!isCar()||!S.track||(S.track.total-project(e.x,e.y,true).s<0.15);","const legDone=!isCar()||!S.track||(S.track.total-project(e.x,e.y,true).s<0.08);")
