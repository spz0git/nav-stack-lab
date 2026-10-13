# Nav Stack Lab — working notes for Claude

- Single-page artifact built from `src/` by `./build.sh` (runs `node build.mjs`, then prepares `tests/wrapped.html`).
  Modules share one scope, concatenated in `src/manifest.json` order; `core/` never touches the DOM (UI hooks in `core/state.js`).
- Published artifact: https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7 (the live page; the owner opens it on desktop and phone).
  Commit the rebuilt `dist/` with every source change so artifact and commit match.
- Publishing rules:
  - Work on a branch and open a PR. While it is open, do not touch the live artifact; when asked to "preview", publish
    `dist/nav-stack-lab.html` as a separate new artifact and give its link.
  - Whenever a change lands on `main` in this session (you merge a PR or push to main), rebuild, run the tests below,
    and republish `dist/nav-stack-lab.html` to the live artifact URL above with `capabilities: {downloads: true}`.
    Say in your reply that the live page was updated.
  - The header shows the version from `src/version.json` (`v20 · 2026-10-13`). Before each republish of the live artifact,
    set `version` to the artifact version the publish will create (the last publish result's version + 1), with the date
    and a short note, rebuild, and commit it; the label then matches the artifact's version history.
- Before committing: `./build.sh`, then from `tests/`: `python3 test.py` (L1–L5 regression summary must not change unless
  intended), `python3 p5test.py` (all Try buttons, ERRORS must be []), `python3 tles.py` (lessons). After editing a lesson
  or a How-it-works note, also `python3 tgloss.py` (glossary: `WITH GAPS 0`; otherwise define the listed symbols in
  `src/ui/glossary.js`).
- Design notes, known limits and next steps live in `docs/roadmap.md`; keep it in sync with the project doc
  `claude/nav-stack-lab-roadmap.md` in the "Robot sim" project.
