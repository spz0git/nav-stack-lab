# reverse speed cap helper
rep("function trackPre(){","const vCap=dir=>dir>0?P.vmax:Math.min(0.35,0.5*P.vmax);   // reverse legs: manoeuvring speed\nfunction trackPre(){")
s=s.replace("Math.min(P.vcruise,dir>0?P.vmax:0.5*P.vmax)","Math.min(P.vcruise,vCap(dir))")
s=s.replace("Math.min(P.vcruise,dir>0?P.vmax:0.5*P.vmax,decelCap(dg)+0.05)","Math.min(P.vcruise,vCap(dir),decelCap(dg)+0.05)")
# dry steering for built-in car controllers
rep("""function builtinCmd(){""","""function builtinCmd(){const c=builtinRaw();
  // car: hold speed until the wheels have turned close to the commanded angle (dry steering at cusps)
  if(isCar()&&c.steer!=null){const de=Math.abs(c.steer-S.robot.d);if(de>0.1)c.v*=clamp(1-(de-0.1)/0.25,0,1);}
  return c;}
function builtinRaw(){""")
rep("const dist=S.cm.dist,L=P.wheelbase,dm=steerMax(),R=minTurnR(),MARG=0.08,","const dist=S.cm.dist,L=P.wheelbase,dm=steerMax(),R=minTurnR(),MARG=0.15,")
# posed arrival tighter
rep("const posed=isCar()&&wp.th!=null,headOK=!posed||Math.abs(wrap(e.th-wp.th))<0.35;\n  if(lastSeg&&headOK&&hyp(e.x-wp.x,e.y-wp.y)<ARRIVE){",
    "const posed=isCar()&&wp.th!=null,headOK=!posed||Math.abs(wrap(e.th-wp.th))<0.2;\n  if(lastSeg&&headOK&&hyp(e.x-wp.x,e.y-wp.y)<(posed?0.2:ARRIVE)){")
rep("start:[2,4,Math.PI/2],wps:[[10.5,15.35,-Math.PI/2],[15.5,8.4,Math.PI/2],[5.6,0.62,0],[2,13]],",
    "start:[2,4,Math.PI/2],wps:[[10.5,15.3,-Math.PI/2],[15.5,8.35,Math.PI/2],[5.6,0.68,0],[2,13]],")
rep("analytic expansion: a Reeds–Shepp shot","margin 0.15 m · analytic expansion: a Reeds–Shepp shot")
rep("A leg ends within 0.12 m of its cusp, and the next leg starts from rest.</p>",
    "A leg ends within 0.12 m of its cusp. The built-in car controllers hold speed until the wheels reach the commanded angle (dry steering), and reverse legs are capped at 0.35 m/s.</p>")
