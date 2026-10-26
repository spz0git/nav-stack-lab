/* ---------- source viewer: the page shows its own modules ---------- */
const SRC_FILES = {
  sen: ['core/sensors.js', 'core/radar.js', 'core/vehicle.js'],
  loc: ['core/localization.js', 'core/slam.js', 'core/pgslam.js', 'core/sensors.js'],
  per: ['core/perception.js', 'core/agents.js', 'core/sensors.js'],
  mis: ['core/mission.js'],
  plan: ['core/planning.js', 'core/planning-dstar.js', 'core/planning-policy.js', 'core/planning-car.js', 'core/path.js'],
  ctl: ['core/controllers.js', 'core/mpc.js', 'core/dispatch.js', 'core/agents.js', 'core/custom-controller.js'],
  veh: ['core/vehicle.js', 'core/worlds.js', 'core/constants.js'],
  an: ['analysis/model.js', 'analysis/num.js']
};
let SRC_INDEX = null;
function sourceIndex() {
  if (SRC_INDEX) return SRC_INDEX;
  const idx = {};
  for (const sc of document.querySelectorAll('script')) {
    if (sc.id === 'core-worker-src') continue; // worker/main.js only, not a module of the page
    const t = sc.textContent;
    const re = /\/\* ---- ([\w\/.-]+) ---- \*\/\n/g;
    let m,
      prev = null;
    while ((m = re.exec(t))) {
      if (prev) idx[prev.name] = t.slice(prev.end, m.index).trimEnd();
      prev = {name: m[1], end: m.index + m[0].length};
    }
    if (prev) {
      let tail = t.slice(prev.end);
      const cut = tail.lastIndexOf('\n})();');
      if (cut > 0) tail = tail.slice(0, cut);
      idx[prev.name] = tail.trimEnd();
    }
  }
  return (SRC_INDEX = idx);
}
function showSource(file) {
  const idx = sourceIndex(),
    names = Object.keys(idx);
  if (!names.length) return;
  if (!idx[file]) file = names[0];
  let d = $('#srcdlg');
  if (!d) {
    d = document.createElement('dialog');
    d.id = 'srcdlg';
    d.className = 'srcdlg';
    d.innerHTML = `<div class="srchead"><select class="sel" id="src-file" aria-label="Module"></select><span class="lbl" id="src-info"></span><button class="btn" id="src-copy">Copy</button><button class="btn" id="src-close">Close</button></div><pre id="src-pre" tabindex="0"></pre>`;
    document.body.appendChild(d);
    $('#src-close').onclick = () => d.close();
    $('#src-copy').onclick = () => {
      if (navigator.clipboard) navigator.clipboard.writeText($('#src-pre').textContent);
    };
    $('#src-file').onchange = e => fillSource(e.target.value);
    d.addEventListener('click', e => {
      if (e.target === d) d.close();
    });
  }
  const sel = $('#src-file');
  sel.innerHTML = names.map(n => `<option value="${n}" ${n === file ? 'selected' : ''}>${n}</option>`).join('');
  fillSource(file);
  if (!d.open) d.showModal();
}
function fillSource(file) {
  const t = sourceIndex()[file] || '';
  $('#src-pre').textContent = t;
  $('#src-info').textContent = `${t.split('\n').length} lines · read-only; the Code tab runs your own version`;
}
// A "// @code <id>" snippet of the page's own source, dedented, with its header (CODE_DATA is the build's index)
function codeSnippet(id) {
  const c = CODE_DATA[id];
  if (!c) return null;
  const mod = sourceIndex()[c.file] || '',
    lines = mod.split('\n');
  const i = lines.findIndex(l => new RegExp(`^\\s*// @code ${id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*\\|`).test(l));
  if (i < 0) return null;
  let j = i + 1;
  while (j < lines.length && !/^\s*\/\/ @end\b/.test(lines[j])) j++;
  const body = lines.slice(i + 1, j),
    ind = Math.min(...body.filter(l => l.trim()).map(l => /^\s*/.exec(l)[0].length));
  return {...c, text: body.map(l => l.slice(ind)).join('\n')};
}
