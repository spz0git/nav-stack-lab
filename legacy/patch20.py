rep(".stage{display:flex;flex-direction:column;gap:10px;min-width:0}",".stage{display:flex;flex-direction:column;gap:10px;min-width:0}\n.stage>*{flex-shrink:0}")
rep("  .mapwrap{width:min(100%,max(420px,calc((100vh - 400px)*1.5)));margin-inline:auto}","  .mapwrap{width:min(100%,max(420px,calc((100vh - 455px)*1.5)));margin-inline:auto}")
rep('<button class="btn" id="stepb">Step 0.5 s</button>','<button class="btn" id="stepb" title="Advance 0.5 s">Step</button>')
rep('<button class="btn" id="clearwp">Clear waypoints</button>','<button class="btn" id="clearwp" title="Clear all waypoints">Clear</button>')
rep("['Collisions',`${S.coll} static · ${S.collPed} people`],","['Collisions',`${S.coll} static, ${S.collPed} people`],")
rep("if(S.pf)items.push(['Particles',`N_eff ${S.pf.neff.toFixed(0)}/${S.pf.N} · inject ${(S.pf.inj*100).toFixed(0)}%`]);","if(S.pf)items.push(['Particles',`N_eff ${S.pf.neff.toFixed(0)}/${S.pf.N}, inj ${(S.pf.inj*100).toFixed(0)}%`]);")
rep("""          <option value="wp">Add waypoint</option>
          <option value="pose">Add posed goal (drag)</option>
          <option value="goal">Set single goal</option>
          <option value="kidnap">Kidnap robot</option>""","""          <option value="wp">Add waypoint</option>
          <option value="pose">Posed goal (drag)</option>
          <option value="goal">Single goal</option>
          <option value="kidnap">Kidnap robot</option>""")
rep("  .mapwrap{width:min(100%,max(420px,calc((100vh - 455px)*1.5)));margin-inline:auto}","  .mapwrap{width:min(100%,max(420px,calc((100vh - 470px)*1.5)));margin-inline:auto}")
