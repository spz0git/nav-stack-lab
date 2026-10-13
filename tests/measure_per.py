import asyncio, json, sys
from playwright.async_api import async_playwright
# Measures what the perception lessons' Try buttons show, headless: map quality against the truth (occupied-cell precision
# and recall over the cells the robot has seen), pose error, people contacts and closest approach, track velocity error,
# replans and mission progress. A case: {name, lvl, set, secs, every}.
RUN=r'''
async ({lvl, overrides, secs, every}) => {
  const N=window.__nav; N.loadLevel(lvl);
  for(const [k,v] of Object.entries(overrides)) N.setParam(k,v,false);
  document.querySelector('#run').click(); document.querySelector('#run').click();
  const S=N.S, LV=N.LV, rows=[]; let vErrSum=0,vErrN=0,trkN=0,trkSamples=0,confMax=0,minClear=Infinity;
  // map quality with one cell of tolerance: an occupied map cell is right if the truth has an obstacle within one cell;
  // a seen truth obstacle cell is recalled if the map has an occupied cell within one cell
  const GW=240,GH=160,near=(A,i,pred)=>{const x=i%GW,y=(i/GW)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=GW||yy>=GH)continue;if(pred(A[yy*GW+xx]))return true;}return false;};
  const mapq=()=>{if(!S.lo)return null;const T=LV.truthOcc,L=S.lo;let tp=0,fp=0,fn=0,seen=0,occ=0;
    for(let i=0;i<L.length;i++){const l=L[i];if(Math.abs(l)<0.05)continue;seen++;
      if(l>0.5){occ++;if(near(T,i,v=>v>0))tp++;else fp++;}
      if(T[i]>0&&!near(L,i,v=>v>0.5))fn++;}
    return{seen,occ,prec:occ?+(tp/occ).toFixed(2):null,rec:(tp+fn)?+(tp/(tp+fn)).toFixed(2):null,fp,fn};};
  const per=Math.round(every/0.05),total=Math.round(secs/every);
  for(let i=0;i<total;i++){
    for(let j=0;j<per;j++){await N.advance(1);{const k=N.cellIdx?N.cellIdx(S.robot.x,S.robot.y):-1;}{const i=Math.floor(S.robot.x/0.1),jj=Math.floor(S.robot.y/0.1);if(i>=0&&jj>=0&&i<GW&&jj<GH)minClear=Math.min(minClear,LV.truthDist[jj*GW+i]-0.3);}
      if(S.agents&&S.agents.tracks){const tr=S.agents.tracks.filter(t=>t.conf);confMax=Math.max(confMax,tr.length);
        if(S.tick%10===0)for(const t of tr){let best=null;for(const p of S.peds){const d=Math.hypot(p.x-t.x,p.y-t.y);if(d<1&&(!best||d<best[0]))best=[d,p];}
          if(best){vErrSum+=Math.hypot((best[1].vx||0)-t.vx,(best[1].vy||0)-t.vy);vErrN++;}}}}
    const r=S.robot,e=S.est,err=Math.hypot(r.x-e.x,r.y-e.y);
    const nees=S.nees.length?S.nees.reduce((a,b)=>a+b,0)/S.nees.length:null;
    const row={t:+S.t.toFixed(0),err:+err.toFixed(2),nees:nees==null?null:+nees.toFixed(1),st:S.fsm.state,done:N.WPS.filter(w=>w.done&&!w.skipped).length,skip:N.WPS.filter(w=>w.skipped).length,coll:S.coll,ped:S.collPed,minPed:isFinite(S.minPed)?+S.minPed.toFixed(2):null,replans:S.log.filter(l=>/^Replan/.test(l.msg)).length};
    const m=mapq();if(m)Object.assign(row,m);
    if(S.pf)row.inj=+(S.pf.inj).toFixed(2);
    rows.push(row);}
  return{rows,vErr:vErrN?+(vErrSum/vErrN).toFixed(2):null,confMax,dist:+S.dist.toFixed(1),minClear:isFinite(minClear)?+minClear.toFixed(2):null,
    log:S.log.filter(l=>/A\*|Replan|yield|Skipping|contact|Paused/i.test(l.msg)).slice(0,10).map(l=>l.t.toFixed(1)+' '+l.msg).reverse()};
}'''
async def main():
    cases=json.loads(sys.argv[1])
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        pg=await b.new_page(viewport={'width':1280,'height':900})
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto('file://'+__import__('os').path.abspath('wrapped.html'))
        await pg.wait_for_timeout(800)
        for c in cases:
            r=await pg.evaluate(RUN,{'lvl':c['lvl'],'overrides':c.get('set',{}),'secs':c.get('secs',150),'every':c.get('every',10)})
            print('==',c.get('name',''),'L%d'%(c['lvl']+1),c.get('set',{}),'vErr',r['vErr'],'confMax',r['confMax'],'dist',r['dist'],'minClear',r['minClear'])
            for row in r['rows']: print('   ',row)
            for l in r['log']: print('      ',l)
        print('ERRORS:',errs[:5])
        await b.close()
asyncio.run(main())
