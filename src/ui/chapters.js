/* ============================================================
   UI: companion notes (chapters) in the Learn column.
   The chapters are written in docs/notes/*.md and converted at build time (tools/notes.mjs); the build fills
   CHAPTERS below. Live values ({{live:key}} in the markdown) are computed here from the current parameters and the
   loop analysis, and refreshed whenever the analysis is invalidated. Try buttons use the lessons' cfg format.
   ============================================================ */
const CHAPTERS=/*__CHAPTERS__*/[];
let chapterOpen=null,chapterFrom=null,chapterSec=null,liveTimer=null;   // chapterFrom: the lesson a link came from
const liveF=(v,d=2)=>v==null||!isFinite(v)?'—':(+v).toFixed(d);
// the pure-pursuit formulas of chapter 6, from the current parameters (valid for pure pursuit on the diff-drive robot)
function ppFormulas(){
  const v0=anV0(),Ld=Math.max(0.1,P.ppL0+P.ppK*v0),g=isCar()?v0/P.wheelbase:1,Ke=2*v0/(Ld*Ld),Kth=2*v0/Ld,T=DT;
  const a=Ke*v0;   // ω⁴ − Kθ²ω² − (Ke v0)² = 0
  const wc=Math.sqrt((Kth*Kth+Math.sqrt(Kth**4+4*a*a))/2),lead=Math.atan(Kth*wc/a)*180/Math.PI,hold=wc*T/2*180/Math.PI,pm=lead-hold;
  const wn=Math.sqrt(g*Ke*v0),zeta=g*Kth/(2*wn);
  return{v0,Ld,Ke,Kth,wc,lead,hold,pm,dm:pm*Math.PI/180/wc,wn,zeta,zero:-v0/Ld,os:100*Math.exp(-Math.PI*zeta/Math.sqrt(1-zeta*zeta)),settle:4/(zeta*wn),ess:100*0.1/Ke};
}
function abGains(){const l=P.agSigA*0.01/0.1,s=Math.sqrt(l*l+8*l);return{a:-(l*l+8*l-(l+4)*s)/8,b:(l*l+4*l-l*s)/4};}
function liveRes(){if(AN.loop!=='lat')return null;if(AN.dirty||!AN.res){anCompute();AN.dirty=false;}return AN.res&&AN.res.M.kind!=='none'?AN.res:null;}
const LIVE={
  ctl:()=>CTL_NAMES[anCtl()]||P.ctl,
  // localization (chapter 2)
  loc:()=>({truth:'ground truth',dr:'dead reckoning',ekf:'the EKF',pf:'the particle filter',slam:'EKF-SLAM',custom:'your own code'})[P.loc]||P.loc,
  odoK:()=>liveF(P.odoK,1),odoB:()=>liveF(P.odoB,1),lmRange:()=>liveF(P.lmRange,0),npart:()=>String(P.npart),
  sigv:()=>liveF(odoErr(anV0()).sv,3),sigw:()=>liveF(odoErr(anV0()).sw,3),
  odoBv:()=>liveF(100*odoErr(anV0()).bv,1),odoBw:()=>liveF(odoErr(anV0()).bw,3),odoDrift:()=>liveF(60*odoErr(anV0()).bw*180/Math.PI,0),
  // perception (chapter 3): the tracker's steady-state α–β gains from the tracking index λ = σa Δt² / σz
  lidarSig:()=>liveF(P.lidarSig,2),infl:()=>liveF(P.infl,1),agSigA:()=>liveF(P.agSigA,1),agT:()=>liveF(P.agT,1),agGrow:()=>liveF(P.agGrow,2),sensLat:()=>liveF(P.sensLat,2),
  lam:()=>liveF(P.agSigA*0.01/0.1,3),alpha:()=>liveF(abGains().a,2),beta:()=>liveF(abGains().b,3),tauv:()=>{const a=abGains().a;return liveF(0.1/(-Math.log(Math.sqrt(1-a))),1);},
  rAtT:()=>liveF(0.35+P.agGrow*P.agT,2),
  // vehicle models (chapter 1)
  wheelbase:()=>liveF(P.wheelbase,2),steerMaxDeg:()=>String(P.steerMaxDeg),ayPlan:()=>liveF(anV0()**2/planR(),2),ayFrac:()=>liveF(100*anV0()**2/planR()/Math.max(0.01,P.alat),0),
  betaMax:()=>liveF(Math.atan(0.5*Math.tan(steerMax()))*180/Math.PI,1),
  // path trackers (chapter 5)
  rwKe:()=>liveF(P.rwKe,1),rwKth:()=>liveF(P.rwKth,1),stanK:()=>liveF(P.stanK,1),alat:()=>liveF(P.alat,2),
  wnRwf:()=>liveF(anV0()*Math.sqrt(P.rwKe)),zetaRwf:()=>liveF(P.rwKth/(2*Math.sqrt(P.rwKe))),
  // MPC (chapter 7)
  mpcNp:()=>String(Math.round(P.mpcNp)),mpcNc:()=>String(Math.min(Math.round(P.mpcNc),Math.round(P.mpcNp))),mpcDt:()=>liveF(P.mpcDt,2),mpcH:()=>liveF(Math.round(P.mpcNp)*P.mpcDt,1),
  mpcIt:()=>String(Math.round(P.mpcIt)),mpcQlat:()=>String(P.mpcQlat),mpcMarg:()=>liveF(P.mpcMarg,2),mpcRho:()=>String(P.mpcRho),
  lagModel:()=>P.lag>0?(P.mpcLag?`τ = ${liveF(P.lag,2)} s, modeled`:`τ = ${liveF(P.lag,2)} s, not modeled`):'none',
  // planning (chapter 4)
  eps:()=>liveF(P.eps,1),rrtIt:()=>String(P.rrtIt),planPct:()=>String(P.planPct),Rmin:()=>liveF(P.wheelbase/Math.tan(steerMax()),2),Rplan:()=>liveF(planR(),2),
  stMarg:()=>liveF(P.stMarg,2),dtc:()=>liveF(0.2/Math.max(0.2,Math.min(P.vcruise,P.vmax)),2),nt:()=>String(Math.ceil(P.agT/(0.2/Math.max(0.2,Math.min(P.vcruise,P.vmax))))+1),
  v0:()=>liveF(anV0()),Ld:()=>liveF(ppFormulas().Ld),
  Ke0:()=>liveF(ppFormulas().Ke,3),Kth0:()=>liveF(ppFormulas().Kth,3),wn0:()=>liveF(ppFormulas().wn),wc0:()=>liveF(ppFormulas().wc),
  lead0:()=>liveF(ppFormulas().lead,1),holdlag0:()=>liveF(ppFormulas().hold,1),pm0:()=>liveF(ppFormulas().pm,1),dm0:()=>liveF(ppFormulas().dm),
  zero:()=>liveF(ppFormulas().zero),os0:()=>liveF(ppFormulas().os,1),settle0:()=>liveF(ppFormulas().settle,1),ess0:()=>liveF(ppFormulas().ess,1),
  Ke:()=>{const R=liveRes();return R&&R.M.Ke!=null?liveF(R.M.Ke,3):'—';},Kth:()=>{const R=liveRes();return R&&R.M.Kth!=null?liveF(R.M.Kth,3):'—';},
  wc:()=>{const R=liveRes();return R?liveF(R.F.wc):'—';},pm:()=>{const R=liveRes();return R?liveF(R.F.pm,1):'—';},
  dm:()=>{const R=liveRes();return R?liveF(R.F.dm):'—';},gm:()=>{const R=liveRes();return R?liveF(R.F.gm,1):'—';},
  w180:()=>{const R=liveRes();return R?liveF(R.F.w180,1):'—';},ms:()=>{const R=liveRes();return R?liveF(R.F.ms):'—';},
  nyq:()=>{const R=liveRes();if(!R)return'—';const N=R.F.Ncw,Pl=R.F.P||0,Z=N+Pl;return`N = ${N}, P = ${Pl}, Z = ${Z} → ${R.stable?'stable':'unstable'}`;},
  zeta:()=>{const R=liveRes();return R?liveF(R.zeta):'—';},wn:()=>{const R=liveRes();return R?liveF(R.wn):'—';},
  dom:()=>{const R=liveRes();return R&&R.dom?`${liveF(R.dom[0])} ± ${liveF(R.dom[1])}j`:'—';},
  os:()=>{const R=liveRes();return R?liveF(R.smOff.overshoot,1):'—';},settle:()=>{const R=liveRes();return R?liveF(R.smOff.settle,1):'—';},
  ess:()=>{const R=liveRes();return R?liveF(100*0.1*Math.abs(R.smBias.final),1):'—';}
};
function chapterLive(){
  const v=$('#learnview');if(!chapterOpen||!v)return;
  v.querySelectorAll('.live').forEach(el=>{const f=LIVE[el.dataset.k];let s='—';try{s=f?f():'?';}catch(_){}el.textContent=s;});
}
function chapterLiveSoon(){if(!chapterOpen)return;clearTimeout(liveTimer);liveTimer=setTimeout(chapterLive,120);}
const chapterById=id=>CHAPTERS.find(c=>c.id===id);
function openChapter(id,sec){
  const c=chapterById(id);if(!c)return false;
  chapterFrom=lessonOpen;if(lessonOpen)lessonBack();
  chapterOpen=id;chapterSec=sec||null;renderLearn();
  const v=$('#learnview'),h=sec&&v.querySelector('#n-'+sec);
  if(h)h.scrollIntoView({block:'start'});else if(v.getBoundingClientRect().top<0)v.scrollIntoView({block:'start'});return true;
}
function chapterBack(){const from=chapterFrom;chapterOpen=null;chapterFrom=null;chapterSec=null;
  if(from&&openLesson(from)){try{history.replaceState(null,'',lessonLink(from).replace(/^[^#]*/,''));}catch(_){}return;}
  renderLearn();if(activeTab==='view')renderAllPanes();}
function chapterLink(id,sec){return location.href.split('#')[0]+`#notes=${id}${sec?'/'+sec:''}`;}
// the list shown in the Learn column when nothing is open
function chaptersListHTML(){
  if(!CHAPTERS.length)return'';
  return`<section class="lgroup notes-list"><h3>Companion notes</h3><p class="note">The mathematics behind each part of the lab, one chapter per tab, with numbers that follow your current settings.</p>`+
    CHAPTERS.map(c=>`<div class="chapter-item" data-sys="${c.sys}"><span class="lnum">${c.num}</span><button type="button" class="linkbtn chapter-open" data-ch="${c.id}">${c.title}</button><span class="note">${c.summary}</span></div>`).join('')+`</section>`;
}
function renderChapter(){
  const v=$('#learnview'),c=chapterById(chapterOpen);
  v.classList.add('reading','chapter');
  v.innerHTML=`<div class="learn-head"><button class="btn small" id="learn-back" type="button" title="${chapterFrom?'Back to the lesson you came from':'Back to the list'}">${chapterFrom?'← Back to the lesson':'← Lessons and notes'}</button><span class="lbl" data-sys="${c.sys}">Chapter ${c.num}</span><button class="linkbtn" id="learn-link" type="button" title="A link that opens this chapter">Copy link</button><span class="lbl" id="learn-msg"></span></div>`+
    `<article class="chapter"><h2>${c.title}</h2><nav class="chapter-toc">${c.toc.map(t=>`<a href="#n-${t.id}" data-to="n-${t.id}">${t.text}</a>`).join('')}</nav>${c.html}</article>`;
  v.querySelectorAll('.chapter-toc a').forEach(a=>a.onclick=e=>{e.preventDefault();const h=v.querySelector('#'+a.dataset.to);if(h)h.scrollIntoView({block:'start',behavior:'smooth'});});
  v.querySelectorAll('button.try').forEach(b=>b.onclick=()=>{let cfg;try{cfg=JSON.parse(b.dataset.cfg);}catch(_){return;}
    if(cfg.sim)tryGo(cfg);else lessonGo(cfg);chapterLiveSoon();});
  $('#learn-back').onclick=chapterBack;
  $('#learn-link').onclick=()=>{const u=chapterLink(chapterOpen),msg=$('#learn-msg');
    try{history.replaceState(null,'','#'+u.split('#')[1]);}catch(_){}
    if(navigator.clipboard)navigator.clipboard.writeText(u).then(()=>{msg.textContent='Link copied.';},()=>{msg.textContent=u;});else msg.textContent=u;};
  chapterLive();
}
// #notes=ch6 opens Learn on that chapter; #notes=ch2/4-the-kalman-update-derived scrolls to that section
function chapterFromHash(){
  const m=/^notes=([\w-]+)(?:\/([\w-]+))?$/.exec(location.hash.slice(1));if(!m||!chapterById(m[1]))return false;
  setUIMode('learn');return openChapter(m[1],m[2]);
}
window.addEventListener('hashchange',chapterFromHash);
