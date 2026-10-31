/* ============================================================
   Custom levels: the level menu's Custom entry. Import a level from a JSON file, export the one on screen (with the
   map as painted and erased), copy a link that carries it, generate one (core/worldgen.js), and keep levels in this
   browser (IndexedDB, next to the trained models: the store 'levels' of ui/train.js's database). The format is
   core/levels.js's.
   ============================================================ */
const CUST = {open: false, saved: [], stored: null, gen: genSpec({gen: 'warehouse', seed: 1}), msg: ''};

/* ---------- a level in a link ---------- */
const b64u = {
  enc(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec: s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
};
const b64uText = s => b64u.enc(new TextEncoder().encode(s)),
  b64uDecText = s => new TextDecoder().decode(b64u.dec(s));
// deflate-raw through the browser's CompressionStream; null where there is none (the link then carries plain JSON)
async function deflateText(s) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const buf = await new Response(new Blob([s]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    return b64u.enc(new Uint8Array(buf));
  } catch (_) {
    return null;
  }
}
async function inflateText(z) {
  if (typeof DecompressionStream === 'undefined') throw new Error('this browser cannot read a compressed level link');
  return new Response(new Blob([b64u.dec(z)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
}
// a generator spec as gen:warehouse,seed:3,w:48,…: short, and readable in the address bar
const genLinkEnc = sp =>
  Object.entries(sp)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
function genLinkDec(s) {
  const o = {};
  for (const part of s.split(',')) {
    const [k, v] = part.split(':');
    if (k) o[k] = v !== '' && isFinite(+v) ? +v : v;
  }
  return genSpec(o);
}
// the level as designed, in the format; made once per level (its designed map does not change)
function levelJSON(L) {
  if (!L.json) L.json = levelToJSON(L);
  return L.json;
}
// the compressed form for the link, made in the background; the hash is written again once it is ready
async function levelLinkPrep(L) {
  if (L.lz !== undefined || LEVELS.includes(L) || L.genSpec) return;
  L.lz = null;
  L.lz = await deflateText(JSON.stringify(levelJSON(L)));
  if (L === LV) hashSoon();
}
// a link's lz= read into the level (asynchronously: the decompression is a stream)
async function configResolve(c) {
  if (c && c.lz) {
    c.levelData = JSON.parse(await inflateText(c.lz));
    delete c.lz;
  }
  return c;
}

/* ---------- kept in this browser ---------- */
async function custLoadSaved() {
  const all = await trnDBdo('all', null, 'levels');
  CUST.stored = !!all;
  CUST.saved = (all || []).sort((a, b) => a.created - b.created);
  buildLevels(); // the menu was built before they were read
}
async function custKeep() {
  const j = levelToJSON(LV, true),
    id = 'lv' + Date.now().toString(36),
    rec = {id, name: j.name, json: j, created: Date.now()};
  CUST.saved.push(rec);
  CUST.stored = !!(await trnDBdo('put', rec, 'levels'));
  custPick(rec);
  CUST.msg = CUST.stored
    ? `Kept “${j.name}” in this browser.`
    : 'This browser does not keep data for this page: the level lasts until it closes (export it as JSON).';
  buildLevels();
}
async function custDelete(id) {
  CUST.saved = CUST.saved.filter(r => r.id !== id);
  await trnDBdo('delete', id, 'levels');
  if (LV.savedId === id) delete LV.savedId;
  buildLevels();
}
// a level picked in the Custom panel keeps the settings you changed, like a built-in one (levelPicked)
function custSwitch(lv, savedId) {
  const {kept} = switchLevel(lv),
    n = Object.keys(kept).length;
  if (savedId) LV.savedId = savedId;
  levelLinkPrep(LV);
  if (n) toast(`${LV.name}: kept the ${n} setting${n > 1 ? 's' : ''} you changed. Changed → Reset all gives this level's own.`, 4500);
  renderAllPanes();
  buildLevels();
}
const custPick = rec => custSwitch(rec.json, rec.id);

/* ---------- the panel ---------- */
const slug = s =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'level';
const edited = () => idList(P.mapAdd).length > 0 || idList(P.mapDel).length > 0 || P.map === 'empty' || idList(P.bOff).length > 0;
function levelFacts(L) {
  const [w, h] = levelSize(L),
    obst = (L.shapes0 || L.shapes).filter(s => !s.border).length;
  return `${w} × ${h} m · ${obst} obstacle${obst === 1 ? '' : 's'} · ${L.beacons.length} beacons · ${L.wps.length} goal${L.wps.length === 1 ? '' : 's'} · ${L.peds.length ? L.peds.length + (L.peds.length > 1 ? ' people' : ' person') : 'nobody'} walking`;
}
function genFormHTML() {
  const G = CUST.gen,
    F = GEN_FAMILIES[G.gen],
    field = (k, def) =>
      `<label>${def[4]} <input type="number" data-gen="${k}" value="${G[k]}" min="${def[1]}" max="${def[2]}" step="${def[3]}"></label>`;
  return `<div class="cust-gen">
  <div class="exprow"><span>Family</span><div class="seg" id="gen-fam">${Object.entries(GEN_FAMILIES)
    .map(([k, f]) => `<button type="button" data-v="${k}" aria-pressed="${k === G.gen}">${f.name}</button>`)
    .join('')}</div></div>
  <p class="note">${F.about[0].toUpperCase() + F.about.slice(1)}.</p>
  <div class="gen-grid">${Object.entries(GEN_COMMON)
    .map(([k, d]) => field(k, d))
    .join('')}</div>
  <div class="gen-grid">${Object.entries(F.params)
    .map(([k, d]) => field(k, d))
    .join('')}</div>
  <div class="exprow gen-seed"><label>settings of <select class="sel" data-gen="like">${GEN_LIKE.map(id => {
    const L = LEVELS.find(x => x.id === id);
    return `<option value="${id}" ${G.like === id ? 'selected' : ''}>${id} ${esc(L.name)}</option>`;
  }).join(
    ''
  )}</select></label><label>seed <input type="number" data-gen="seed" value="${G.seed}" min="1" max="99999" step="1"></label><button type="button" class="btn small" id="gen-next" title="The next seed: another world of the same kind">Next seed</button></div>
  <div class="controls"><button type="button" class="btn small primary" id="gen-go">Generate</button><span class="lbl">The area is at most ${WORLD_AREA} m²; a large floor runs slower on a phone.</span></div></div>`;
}
// The brief's content for the Custom panel (the current level's actions, import, generate, the kept levels)
function custBriefHTML() {
  const L = LV,
    own = !LEVELS.includes(L),
    kept = CUST.saved;
  return `<div class="adds-d"><h3>${own ? `This level: <span class="lvname">${esc(L.name)}</span>` : `Custom level · now on <span class="lvname">${L.id} ${esc(L.name)}</span>`}</h3>
  ${own ? `<p class="adds">${esc(L.adds)}</p>` : ''}<p class="lbl">${levelFacts(L)}${edited() ? ' · the map is edited (painted or erased)' : ''}</p>
  <div class="controls"><button type="button" class="btn small" id="cust-export" title="Save the level as JSON, with the map as painted and erased and the goals placed">Export JSON</button><button type="button" class="btn small" id="cust-link" title="Copy a link that carries the level and the setup">Copy link</button>${L.savedId && !edited() ? '' : `<button type="button" class="btn small" id="cust-keep" title="Keep this level, with its edits, in this browser">Keep in this browser</button>`}<label class="btn small trn-file">Import JSON<input type="file" id="cust-import" accept=".json,application/json" hidden></label></div>
  <p class="codestat" id="cust-msg" aria-live="polite">${esc(CUST.msg)}</p></div>
  <details class="try" open><summary><h3>Generate a level</h3></summary>${genFormHTML()}</details>
  <details class="try" ${kept.length ? 'open' : ''}><summary><h3>Kept in this browser (${kept.length})</h3></summary>${
    kept.length
      ? `<ul class="cust-kept">${kept
          .map(
            r =>
              `<li><b>${esc(r.name)}</b><span class="lbl">${r.json.size.join(' × ')} m${r.json.gen ? ' · generated' : ''}</span><div class="controls"><button type="button" class="btn small" data-cload="${r.id}">Load</button><button type="button" class="btn small" data-cdl="${r.id}">JSON</button><button type="button" class="btn small" data-cdel="${r.id}">${CUST.delArm === r.id ? 'Delete?' : 'Delete'}</button></div></li>`
          )
          .join('')}</ul>`
      : `<p class="note">${CUST.stored === false ? 'This browser does not keep data for this page.' : 'None yet. Import or generate a level, then Keep it.'}</p>`
  }</details>`;
}
function custWire(root) {
  const on = (sel, fn) => {
    const el = root.querySelector(sel);
    if (el) el.onclick = fn;
  };
  const say = m => {
    CUST.msg = m;
    const el = root.querySelector('#cust-msg');
    if (el) el.textContent = m;
  };
  on('#cust-export', () => {
    const j = levelToJSON(LV, true);
    download(`nav-lab-level-${slug(j.name)}.json`, JSON.stringify(j, null, 1), 'application/json').then(ok =>
      say(ok ? 'Saved.' : 'Could not save the file here.')
    );
  });
  on('#cust-link', async () => {
    await levelLinkPrep(LV);
    const u = configURL();
    history.replaceState(null, '', '#' + u.split('#')[1]);
    hashLast = u.split('#')[1];
    if (navigator.clipboard)
      navigator.clipboard.writeText(u).then(
        () => say(`Link copied (${u.length} characters).`),
        () => say(u)
      );
    else say(u);
  });
  on('#cust-keep', () => custKeep());
  const imp = root.querySelector('#cust-import');
  if (imp)
    imp.onchange = async () => {
      const f = imp.files && imp.files[0];
      if (!f) return;
      try {
        const j = JSON.parse(await f.text());
        levelFromJSON(j); // checked before anything changes
        const rec = {
          id: 'lv' + Date.now().toString(36),
          name: plainText(j.name, LEVEL_LIMITS.name) || 'Custom level',
          json: j,
          created: Date.now()
        };
        CUST.saved.push(rec);
        CUST.stored = !!(await trnDBdo('put', rec, 'levels'));
        CUST.msg = `Imported “${rec.name}”${CUST.stored ? ' and kept it in this browser' : ''}.`;
        custPick(rec);
      } catch (e) {
        say('Could not import that file: ' + e.message);
      }
    };
  root.querySelectorAll('#gen-fam button').forEach(
    b =>
      (b.onclick = () => {
        CUST.gen = genSpec({...CUST.gen, gen: b.dataset.v});
        buildLevels();
      })
  );
  root.querySelectorAll('[data-gen]').forEach(
    el =>
      (el.onchange = () => {
        CUST.gen = genSpec({...CUST.gen, [el.dataset.gen]: el.dataset.gen === 'like' ? el.value : +el.value});
        el.value = CUST.gen[el.dataset.gen];
      })
  );
  on('#gen-next', () => {
    CUST.gen = genSpec({...CUST.gen, seed: CUST.gen.seed + 1});
    custGenerate(say);
  });
  on('#gen-go', () => custGenerate(say));
  root.querySelectorAll('[data-cload]').forEach(b => (b.onclick = () => custPick(CUST.saved.find(r => r.id === b.dataset.cload))));
  root.querySelectorAll('[data-cdl]').forEach(
    b =>
      (b.onclick = () => {
        const r = CUST.saved.find(x => x.id === b.dataset.cdl);
        download(`nav-lab-level-${slug(r.name)}.json`, JSON.stringify(r.json, null, 1), 'application/json');
      })
  );
  root.querySelectorAll('[data-cdel]').forEach(
    b =>
      (b.onclick = () => {
        if (CUST.delArm !== b.dataset.cdel) {
          CUST.delArm = b.dataset.cdel;
          buildLevels();
          return;
        }
        CUST.delArm = null;
        custDelete(b.dataset.cdel);
      })
  );
}
function custGenerate(say) {
  try {
    const t0 = performance.now();
    custSwitch(CUST.gen);
    CUST.msg = `Generated in ${(performance.now() - t0).toFixed(0)} ms: ${LV.name}.`;
    buildLevels();
  } catch (e) {
    say('Could not generate it: ' + e.message);
  }
}
