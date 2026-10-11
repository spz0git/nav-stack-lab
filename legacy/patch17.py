# separate colour for beacons (teal), lidar hits stay amber
rep("--accent:#2058c9; --accent-ink:#ffffff; --amber:#9c6a00;","--accent:#2058c9; --accent-ink:#ffffff; --amber:#9c6a00; --beacon:#008a87;")
s=s.replace("--accent:#729dff; --accent-ink:#0a1020; --amber:#dfae48;","--accent:#729dff; --accent-ink:#0a1020; --amber:#dfae48; --beacon:#3fd0c6;")
assert s.count("--beacon:#3fd0c6;")==2
rep("const names=['bg','panel','ink','muted','line','accent','amber',","const names=['bg','panel','ink','muted','line','accent','amber','beacon',")
rep("for(const b of S.beacons){ctx.fillStyle=TOK.amber;ctx.beginPath();const s=0.16;ctx.moveTo(b.x,b.y+s);ctx.lineTo(b.x+s,b.y);ctx.lineTo(b.x,b.y-s);ctx.lineTo(b.x-s,b.y);ctx.closePath();ctx.fill();}",
    "for(const b of S.beacons){ctx.fillStyle=TOK.beacon;ctx.strokeStyle=TOK['map-bg'];ctx.lineWidth=px(1);ctx.beginPath();const s=Math.max(0.18,px(6));ctx.moveTo(b.x,b.y+s);ctx.lineTo(b.x+s,b.y);ctx.lineTo(b.x,b.y-s);ctx.lineTo(b.x-s,b.y);ctx.closePath();ctx.fill();ctx.stroke();}")
rep("ctx.strokeStyle=m.fake?rgba(TOK.bad,0.6):rgba(TOK.amber,0.55);","ctx.strokeStyle=m.fake?rgba(TOK.bad,0.6):rgba(TOK.beacon,0.6);")
rep("ctx.fillStyle=m.fake?TOK.bad:TOK.amber;ctx.beginPath();ctx.arc(x,y,px(2.5),0,TAU);ctx.fill();}","ctx.fillStyle=m.fake?TOK.bad:TOK.beacon;ctx.beginPath();ctx.arc(x,y,px(2.5),0,TAU);ctx.fill();}")
rep("""<span><i class="dot" style="background:var(--amber)"></i>lidar hits · beacons</span>""",
    """<span><i class="dot" style="background:var(--amber)"></i>lidar hits</span>
        <span><i class="dot" style="background:var(--beacon);border-radius:1px;transform:rotate(45deg)"></i>beacons & readings (red = false)</span>""")
