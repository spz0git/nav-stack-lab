rep("if(dg<0.25&&(goalTh==null||Math.abs(wrap(th-goalTh))<0.15)){fin=u;break;}",
    "if(dg<0.15&&(goalTh==null||Math.abs(wrap(th-goalTh))<0.12)){fin=u;break;}   // inside the arrival tolerance")
rep("""      for(let ci=0;ci<Math.min(4,cs.length)&&!tail;ci++){
        const segs=RS.sample([x,y,th],cs[ci],R,SUB);let ok=true;""",
"""      for(let ci=0,tried=0;ci<cs.length&&tried<4&&!tail;ci++){
        // reject shots with gear legs too short to execute (< 0.25 m)
        let short=false,acc=0,sg0=0;for(const d of cs[ci].L){const sg=Math.sign(d);if(Math.abs(d)<1e-9)continue;if(sg!==sg0&&sg0!==0){if(acc<0.25)short=true;acc=0;}sg0=sg;acc+=Math.abs(d)*R;}if(acc<0.25&&cs[ci].len*R>0.25)short=true;
        if(short)continue;tried++;
        const segs=RS.sample([x,y,th],cs[ci],R,SUB);let ok=true;""")
rep("""  const posed=isCar()&&wp.th!=null,headOK=!posed||Math.abs(wrap(e.th-wp.th))<0.2;
  if(lastSeg&&headOK&&hyp(e.x-wp.x,e.y-wp.y)<(posed?0.2:ARRIVE)){""",
"""  const posed=isCar()&&wp.th!=null,headOK=!posed||Math.abs(wrap(e.th-wp.th))<0.2;
  const legDone=!isCar()||!S.track||(S.track.total-project(e.x,e.y,true).s<0.15);
  if(lastSeg&&headOK&&legDone&&hyp(e.x-wp.x,e.y-wp.y)<(posed?0.2:ARRIVE)){""")
