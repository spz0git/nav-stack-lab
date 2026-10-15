
/* NUM_BEGIN */
// ---- complex numbers as [re, im] ----
const Cx={add:(a,b)=>[a[0]+b[0],a[1]+b[1]],sub:(a,b)=>[a[0]-b[0],a[1]-b[1]],mul:(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]],
  div:(a,b)=>{const d=b[0]*b[0]+b[1]*b[1]||1e-300;return[(a[0]*b[0]+a[1]*b[1])/d,(a[1]*b[0]-a[0]*b[1])/d];},
  abs:a=>Math.hypot(a[0],a[1]),arg:a=>Math.atan2(a[1],a[0]),exp:a=>{const m=Math.exp(a[0]);return[m*Math.cos(a[1]),m*Math.sin(a[1])];},
  sqrt:a=>{const r=Math.hypot(a[0],a[1]),re=Math.sqrt(Math.max(0,(r+a[0])/2)),im=Math.sqrt(Math.max(0,(r-a[0])/2));return[re,a[1]<0?-im:im];},
  log:a=>[Math.log(Math.hypot(a[0],a[1])||1e-300),Math.atan2(a[1],a[0])],scale:(a,k)=>[a[0]*k,a[1]*k]};
// ---- polynomials, ascending powers ----
const pMul=(a,b)=>{const r=new Array(a.length+b.length-1).fill(0);for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)r[i+j]+=a[i]*b[j];return r;};
const pAdd=(a,b)=>{const n=Math.max(a.length,b.length),r=[];for(let i=0;i<n;i++)r.push((a[i]||0)+(b[i]||0));return r;};
const pScale=(a,k)=>a.map(v=>v*k);
function pEval(p,s){let r=[0,0];for(let i=p.length-1;i>=0;i--)r=Cx.add(Cx.mul(r,s),[p[i],0]);return r;}
// matrix exponential of a small real matrix: scaling and squaring with a Taylor series
function expm(A){
  const n=A.length,mm=(X,Y)=>X.map(r=>Y[0].map((_,j)=>r.reduce((s,x,l)=>s+x*Y[l][j],0)));
  let nrm=0;for(const r of A)nrm=Math.max(nrm,r.reduce((s,x)=>s+Math.abs(x),0));
  const k=nrm>0.5?Math.ceil(Math.log2(nrm/0.5)):0,X=A.map(r=>r.map(x=>x*Math.pow(2,-k)));
  let E=X.map((r,i)=>r.map((_,j)=>i===j?1:0)),T=E;
  for(let m=1;m<=16;m++){T=mm(T,X).map(r=>r.map(x=>x/m));E=E.map((r,i)=>r.map((x,j)=>x+T[i][j]));}
  for(let i=0;i<k;i++)E=mm(E,E);
  return E;
}
// solve A x = b for a small complex matrix (entries [re, im]) by Gaussian elimination with partial pivoting
function cxSolve(A,b){
  const n=A.length,M=A.map((r,i)=>r.map(v=>v.slice()).concat([b[i].slice()]));
  for(let c=0;c<n;c++){let p=c;for(let i=c+1;i<n;i++)if(Cx.abs(M[i][c])>Cx.abs(M[p][c]))p=i;[M[c],M[p]]=[M[p],M[c]];
    for(let i=c+1;i<n;i++){const f=Cx.div(M[i][c],M[c][c]);for(let j=c;j<=n;j++)M[i][j]=Cx.sub(M[i][j],Cx.mul(f,M[c][j]));}}
  const x=new Array(n);for(let i=n-1;i>=0;i--){let s=M[i][n];for(let j=i+1;j<n;j++)s=Cx.sub(s,Cx.mul(M[i][j],x[j]));x[i]=Cx.div(s,M[i][i]);}
  return x;
}
// roots (Aberth–Ehrlich); zero roots split off exactly
function pRoots(p){
  let a=p.slice();while(a.length>1&&Math.abs(a[a.length-1])<1e-14*Math.max(...a.map(Math.abs)))a.pop();
  const out=[];let z=0;while(z<a.length-1&&Math.abs(a[z])<1e-14*Math.max(...a.map(Math.abs)))z++;
  for(let i=0;i<z;i++)out.push([0,0]);a=a.slice(z);const n=a.length-1;if(n<1)return out;
  const lead=a[n],c=a.map(v=>v/lead),R=1+Math.max(...c.slice(0,n).map(Math.abs));
  let x=[];for(let i=0;i<n;i++)x.push([R*0.5*Math.cos(2*Math.PI*i/n+0.4),R*0.5*Math.sin(2*Math.PI*i/n+0.4)]);
  const dp=[];for(let i=1;i<=n;i++)dp.push(i*c[i]);
  for(let it=0;it<500;it++){let mx=0;
    for(let i=0;i<n;i++){const pv=pEval(c,x[i]),dv=pEval(dp,x[i]),ratio=Cx.div(pv,dv);let s=[0,0];
      for(let j=0;j<n;j++)if(j!==i)s=Cx.add(s,Cx.div([1,0],Cx.sub(x[i],x[j])));
      const w=Cx.div(ratio,Cx.sub([1,0],Cx.mul(ratio,s)));x[i]=Cx.sub(x[i],w);mx=Math.max(mx,Cx.abs(w)/(1+Cx.abs(x[i])));}
    if(mx<1e-13)break;}
  return out.concat(x.map(r=>Math.abs(r[1])<1e-9*(1+Math.abs(r[0]))?[r[0],0]:r));
}
// eigenvalues of a small real matrix: shifted complex QR on the full matrix with deflation
function eig(A){
  const n=A.length;let H=A.map(r=>r.map(v=>[v,0]));const ev=[];let m=n,iter=0;
  let nrm=0;for(const r of A)for(const v of r)nrm=Math.max(nrm,Math.abs(v));const atol=1e-13*(nrm||1);
  while(m>0){
    if(m===1){ev.push(H[0][0]);break;}
    let off=0,scale=Cx.abs(H[m-1][m-1])+Cx.abs(H[m-2][m-2])+1e-300;for(let j=0;j<m-1;j++)off=Math.max(off,Cx.abs(H[m-1][j]));
    if(off<1e-12*scale||off<atol){ev.push(H[m-1][m-1]);H=H.slice(0,m-1).map(r=>r.slice(0,m-1));m--;iter=0;continue;}
    // Wilkinson shift from the trailing 2×2
    const a=H[m-2][m-2],b=H[m-2][m-1],c=H[m-1][m-2],d=H[m-1][m-1],tr=Cx.add(a,d),det=Cx.sub(Cx.mul(a,d),Cx.mul(b,c));
    const disc=Cx.sqrt(Cx.sub(Cx.scale(Cx.mul(tr,tr),0.25),det)),l1=Cx.add(Cx.scale(tr,0.5),disc),l2=Cx.sub(Cx.scale(tr,0.5),disc);
    let mu=Cx.abs(Cx.sub(l1,d))<Cx.abs(Cx.sub(l2,d))?l1:l2;
    if(iter>0&&iter%25===0)mu=Cx.add(d,[0.7*off,0.3*off]);  // exceptional shift
    iter++;if(iter>600){ev.push(H[m-1][m-1]);H=H.slice(0,m-1).map(r=>r.slice(0,m-1));m--;iter=0;continue;}
    // QR of (H − μI) by modified Gram–Schmidt
    const B=H.map((r,i)=>r.map((v,j)=>i===j?Cx.sub(v,mu):v));
    const Q=[],R=Array.from({length:m},()=>Array.from({length:m},()=>[0,0]));
    for(let j=0;j<m;j++){let v=B.map(r=>r[j]);
      for(let k=0;k<j;k++){let dot=[0,0];for(let i=0;i<m;i++)dot=Cx.add(dot,Cx.mul([Q[k][i][0],-Q[k][i][1]],v[i]));R[k][j]=dot;for(let i=0;i<m;i++)v[i]=Cx.sub(v[i],Cx.mul(dot,Q[k][i]));}
      let nr=0;for(let i=0;i<m;i++)nr+=v[i][0]**2+v[i][1]**2;nr=Math.sqrt(nr);R[j][j]=[nr,0];
      Q.push(nr>1e-300?v.map(x=>Cx.scale(x,1/nr)):v.map((x,i)=>i===j?[1,0]:[0,0]));}
    const Hn=Array.from({length:m},()=>Array.from({length:m},()=>[0,0]));
    for(let i=0;i<m;i++)for(let j=0;j<m;j++){let s=[0,0];for(let k=i;k<m;k++)s=Cx.add(s,Cx.mul(R[i][k],Q[j][k]));Hn[i][j]=i===j?Cx.add(s,mu):s;}
    H=Hn;
  }
  return ev.map(z=>Math.abs(z[1])<1e-10*(1+Math.abs(z[0]))?[z[0],0]:z);
}
