# Nav Stack Lab — working notes for Claude

- Single-page artifact built from `src/` by `./build.sh` (runs `node build.mjs`, then prepares `tests/wrapped.html`).
  Modules share one scope, concatenated in `src/manifest.json` order; `core/` never touches the DOM (UI hooks in `core/state.js`).
- Published artifact: https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7 — republish from `dist/nav-stack-lab.html`
  with `capabilities: {downloads: true}`. Commit the rebuilt `dist/` with every source change so artifact and commit match.
- Before committing: `./build.sh`, then from `tests/`: `python3 test.py` (L1–L5 regression summary must not change unless
  intended), `python3 p5test.py` (all Try buttons, ERRORS must be []), `python3 tles.py` (lessons).
- Design notes, known limits and next steps live in `docs/roadmap.md`; keep it in sync with the project doc
  `claude/nav-stack-lab-roadmap.md` in the "Robot sim" project.
