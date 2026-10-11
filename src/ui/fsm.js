/* ---------- live state diagram of the behaviour layer (Mission tab) ---------- */
const FSM_NODES={IDLE:[60,96],PLAN:[200,96],DRIVE:[360,96],DONE:[520,96],NO_PATH:[200,186],LOST:[360,186]};
const FSM_EDGES=[['IDLE','PLAN','Run'],['PLAN','DRIVE','path found'],['DRIVE','PLAN','arrived, next goal · path blocked · stuck · periodic · agent blocking'],['PLAN','NO_PATH','no path'],['NO_PATH','PLAN','2 s'],['DRIVE','DONE','last goal'],['DRIVE','LOST','σ > 1 m'],['LOST','PLAN','σ < 0.4 m'],['DONE','PLAN','new goal']];
let fsmLast={from:null,to:null,t:-1};
function fsmSVG(){
  const cur=S?S.fsm.state:'IDLE';const box=(n,[x,y])=>`<g data-fsm="${n}"><rect x="${x-44}" y="${y-16}" width="88" height="32" rx="6" class="fsm-box${n===cur?' on':''}"/><text x="${x}" y="${y+4}" class="fsm-t${n===cur?' on':''}">${n.replace('_',' ')}</text></g>`;
  const edge=([a,b,l])=>{const[x1,y1]=FSM_NODES[a],[x2,y2]=FSM_NODES[b];const hot=fsmLast.from===a&&fsmLast.to===b&&S&&S.t-fsmLast.t<1.5;let d,lx,ly,an='middle';
    if(a==='DRIVE'&&b==='PLAN'){d=`M${x1-20} ${y1-16}C${x1-40} ${y1-60},${x2+40} ${y2-60},${x2+20} ${y2-16}`;lx=(x1+x2)/2;ly=y1-52;}
    else if(a==='DONE'&&b==='PLAN'){d=`M${x1-10} ${y1-16}C${x1-30} ${y1-90},${x2+30} ${y2-90},${x2-10} ${y2-16}`;lx=(x1+x2)/2;ly=y1-78;}
    else if(a==='LOST'&&b==='PLAN'){d=`M${x1-44} ${y1-6}L${x2+44} ${y2+10}`;lx=(x1+x2)/2+14;ly=(y1+y2)/2+20;an='start';}
    else if(y1===y2){d=`M${x1+44} ${y1}H${x2-44}`;lx=(x1+x2)/2;ly=y1-8;}
    else if(y1<y2){d=`M${x1-12} ${y1+16}V${y2-16}`;lx=x1-18;ly=(y1+y2)/2+3;an='end';}
    else{d=`M${x1+12} ${y1-16}V${y2+16}`;lx=x1+18;ly=(y1+y2)/2+3;an='start';}
    return`<path d="${d}" class="fsm-e${hot?' hot':''}" marker-end="url(#fsm-arr)"/><text x="${lx}" y="${ly}" class="fsm-l${hot?' hot':''}" text-anchor="${an}">${l}</text>`;};
  return`<svg viewBox="0 0 600 214" class="fsm" role="img" aria-label="Mission state machine, current state ${cur}"><defs><marker id="fsm-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" class="fsm-a"/></marker></defs>${FSM_EDGES.map(edge).join('')}${Object.keys(FSM_NODES).map(n=>box(n,FSM_NODES[n])).join('')}<text x="200" y="212" class="fsm-l" text-anchor="middle">3 failures in a row skip the goal</text></svg>`;
}
function fsmTrack(){if(!S)return;const st=S.fsm.state;if(fsmTrack.prev&&fsmTrack.prev!==st){fsmLast={from:fsmTrack.prev,to:st,t:S.t};}fsmTrack.prev=st;}
function fsmRefresh(){fsmTrack();const el=$('#fsm-wrap');if(!el||activeTab!=='mis')return;const key=S.fsm.state+'|'+fsmLast.from+fsmLast.to+(S.t-fsmLast.t<1.5);if(el.dataset.key===key)return;el.dataset.key=key;el.innerHTML=fsmSVG();}
