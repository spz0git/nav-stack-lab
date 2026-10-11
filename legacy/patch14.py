rep("""function mpcReference(Np,dt){
  const e=S.est,T=S.track,pr=project(e.x,e.y,true),dir=T.dir||1,ref=[];""","""function mpcReference(Np,dt){
  const{T,pr,dir}=trackPre(),ref=[];   // also advances the path-progress index""")
