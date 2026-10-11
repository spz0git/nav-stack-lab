rep("for(let i=1;i<n-1;i++){const l=(s[i+1]-s[i-1])/2;kv[i]=l>1e-6?wrap(hd[i]-hd[i-1])/l:0;}if(n>2)kv[0]=kv[1];",
    "for(let i=1;i<n-1;i++){const l=(s[i+1]-s[i-1])/2;kv[i]=l>1e-6?wrap(hd[i]-hd[i-1])/l:0;}if(n>2){kv[0]=kv[1];kv[n-1]=kv[n-2];}")
rep("const k=clamp(kapAt(pr.s+0.1+0.3*vprev),-kmax,kmax);","const k=clamp(kapAt(pr.s+0.2),-kmax,kmax);   // fixed preview covers steering-rate lag")
rep("const decelCap=d=>Math.sqrt(2*(P.accel?P.amax:0.8)*Math.max(0,d-(isCar()?0.02:0.08)))+(isCar()&&d>0.03?0.05:0);   // car creeps to the leg end",
    "const decelCap=d=>isCar()?Math.min(Math.sqrt(2*(P.accel?P.amax:0.8)*Math.max(0,d-0.02)),0.1+0.6*d)+(d>0.03?0.04:0)   // car: linear ramp into each leg end\n  :Math.sqrt(2*(P.accel?P.amax:0.8)*Math.max(0,d-0.08));")
rep("rwKth:2.0,rwKe:3.0,","rwKth:3.0,rwKe:6.0,")
rep("e: lateral offset (+ left),  θe: heading error,  κ(s) previewed 0.1 m + 0.3 s ahead</div>","e: lateral offset (+ left),  θe: heading error,  κ(s) previewed 0.2 m ahead</div>")
