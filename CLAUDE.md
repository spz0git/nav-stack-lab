# Nav Stack Lab — working notes for Claude

- Single-page artifact built from `src/` by `./build.sh` (runs `node build.mjs`); `dist/nav-stack-lab.html` is a complete standalone document (the tests load it directly) with the fonts embedded (`src/fonts/`), so it makes no network request at runtime.
  Modules share one scope, concatenated in `src/manifest.json` order; `core/` never touches the DOM (UI hooks in `core/state.js`).
  To look at the built page in the desktop app's browser pane, `.claude/launch.json` serves the repo on port 8765
  (`preview_start` name `dist`, then open `/dist/nav-stack-lab.html`).
- Published artifact: https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7 (the live page; the owner opens it on desktop and phone).
  The public demo is GitHub Pages (https://spz0git.github.io/nav-stack-lab/, deployed from `main` by a workflow); it is off
  while the repository is private, and the workflow skips unless the repository variable `PAGES_ENABLED` is `true`. The full
  release procedure is in `docs/maintaining.md`; the rules below are the short form.
  Commit the rebuilt `dist/` with every source change so artifact and commit match.
- Publishing rules:
  - Work on a branch and open a PR. While it is open, do not touch the live artifact; when asked to "preview", publish
    `dist/nav-stack-lab.html` as a separate new artifact and give its link.
  - The tests run once per change, right before the merge (the owner works alone; running them on the branch and again
    on `main` only repeats them). While working, build and check the change in the page; do not run the gate.
    When the PR is ready to merge, make the release commit on the branch (version and changelog, below), rebuild, run
    the gate (`npm run lint`, `npm run fmt:check`, `npm test`, `python3 tests/run_all.py`), then merge. If a script
    fails, fix it and rerun what failed (the whole gate when the fix touches shared code). Do not run the gate again on
    `main`: its tree is the one tested, unless something else landed in between; then bring the branch up to date first
    and run the gate there. A change that leaves `dist/` as it is (documentation outside the lessons, chapters and
    changelog, CI files) needs no gate, no version and no republish.
  - Whenever a change to the page lands on `main` in this session, republish `dist/nav-stack-lab.html` to the live
    artifact URL above with `capabilities: {downloads: true}`. Say in your reply that the live page was updated.
  - The header shows the version from `src/version.json` (`v25 · 2026-10-14`). In the release commit, set `version` to
    the artifact version the publish will create (the last publish result's version + 1), with the date and a short note;
    the label then matches the artifact's version history (check the publish result's Version against it).
  - The version label opens What's new, which is `CHANGELOG.md` inlined by the build (`tools/changelog.mjs`; `## Unreleased`
    is left out). Write each entry for someone who uses the page; file names and internals go in the PR, not the log.
    In the release commit, rename `## Unreleased` to `## vNN · date`.
  - After each live republish, delete the previous artifacts: list them (Artifact `action: "list"`) and delete every
    "Nav Stack Lab" page artifact except the live URL above (the PR previews and any older builds). Never delete the live
    artifact, and leave artifacts with other titles alone (e.g. "Nav Stack Lab — Companion Notes", other projects).
    Say in your reply which ones were deleted.
- Companion notes (the Learn column's chapters) are written in `docs/notes/<id>.md` (markdown subset + TeX; see the header of
  `tools/notes.mjs` for the `{{live:key}}` and `[try: … | {cfg}]` extensions). The build converts them to HTML with MathML
  (`tools/vendor/temml`, build-time only; the page keeps zero runtime dependencies). Live values are defined in
  `src/ui/chapters.js` (LIVE). `tests/chtest.py` opens every chapter, checks every live value fills, presses every Try button, and
  follows every derivation link in the lessons (`a.chref`, `#notes=<ch>/<section-slug>`) there and back.
- The code behind the lessons: a function marked `// @code <id> | <title>` … `// @end` in the source becomes a snippet the
  lessons can show (`## Code:` section: `snippet:`, `focus:` lines by substring, `example:`, `Note:`; see `tools/code.mjs`
  and `tools/lessons.mjs`); the page cuts the text from its own source at runtime, the build only indexes and validates.
  Slot examples live in `src/examples/<slot>/<nn>-<id>.js` (first line `// @example <name>`; not formatted by Prettier) and
  fill the Code tab's menu and the lessons' "Edit and run". `tests/extest.py` runs every example against its built-in.
- Learned blocks: weights in `src/models/<name>.json`, inlined by the build as `MODELS` and run by `src/core/nn.js` (plain
  loops, no dependency; keep each model under about 1 MB). Training is Python under `training/` (PyTorch in `.venv`; see
  `training/README.md`); data from `tools/collect-*.mjs` over the headless core into `training/data/`, which is not
  committed. Changing a model's input features means changing the collector, the trainer and the page's feature code.
  The page can train too (Tools → Train, `src/ui/train.js`): data from `collectRun` (`src/core/dataset.js`, which the
  collectors also call), backprop and Adam in `src/core/nn-train.js`, models kept in the browser's IndexedDB and picked
  by `P.detModel` / `P.polModel`; `tests/trtest.py` drives it.
- Lessons are markdown in `docs/lessons/<group>/*.md` (format in the header of `tools/lessons.mjs`; the build inlines them as
  `LESSON_DATA`): a `## Try: Label` section per experiment with `cfg:`, `Setup:`, `See:`, `Shows:`, `Predict:` + options + `Answer:`;
  `## Think about` Q:/A: pairs; `## Check yourself`. Math in lessons is TeX (`$…$`, `$$…$$`), turned into MathML at build time like the chapters'; in JS strings (the How it works panels in `src/ui/notes.js`, Analyze's derivations) it goes in a template literal tagged `TEX`, which the build rewrites (`texSource` in `tools/tex.mjs`; `${…}` inside `$…$` becomes a number). Their terms stay in `LESSON_TERMS` (`src/analysis/glossary.js`), keyed by title. Numbers in a lesson's "What you will see" are measured headless first
  (`tests/measure_loc.py` for localization, `tests/measure_per.py` for perception, `tests/measure_plan.py` for planning, which can press a Try button's cfg exactly; `tests/measure_dyn.py` for the car with tyre slip, which presses every Try of a control lesson by title; `tests/tles.py` prints the analysis numbers for the control lessons); derivations go in the chapter, the lesson keeps a short "where it comes from" and the link.
  A Predict's answer must be one the learner can check by looking (the plots, the status strip, the map, the log; not an
  RMS only a script computes), and one that holds at other seeds (`"seed": n` in the cfg) when it compares runs.
- The gate (once, before the merge; see Publishing rules): `./build.sh`, then from `tests/`: `python3 test.py` (L1–L5 regression summary must not change unless
  intended), `python3 p5test.py` (all Try buttons, ERRORS must be []), `python3 tles.py` (lessons), `python3 chtest.py` (companion notes),
  `python3 dyntest.py` (the car with tyre slip against chapter 1's theory, Analyze against the simulator; FAILS must be []),
  `python3 extest.py` (every slot example against its built-in; FAILS must be []), `python3 trtest.py` (the Train tab: collect,
  train, save, use; ERRORS must be []), `python3 lvtest.py` (custom and generated levels: menu, links, import and export,
  missions on every generator family; ERRORS must be []), `python3 sntest.py` (the Sensors switchboard: each sensor off on
  L3 and L5; FAILS must be []). `python3 tests/run_all.py` runs all nine.
- Levels are data: the JSON format is in the header of `src/core/levels.js` (built-ins convert to it and back unchanged,
  `tests/node/levels.test.mjs`); the world's size (`W`, `H`, `GW`, `GH`, `NC`) is the level's, set by `setWorld` in
  `loadLevel`, so nothing may assume 24 × 16 m or cache a grid-sized array across levels. Generators are in
  `src/core/worldgen.js`; `loadLevel`, the worker and `collectRun` take a level index, a level in the format or a
  generator spec, and the collectors take `--gen`.
- Design notes, known limits and next steps live in `docs/roadmap.md`. The GitHub repo is the only reference: there are
  no copies elsewhere (Claude projects, docs) to keep in sync.
- Project summary: `docs/PROJECT-SUMMARY.md` feeds the owner's master planning vault, which reads it from `origin/main`.
  When a PR changes where the project stands (a release, a design decided, a new risk or blocker, a different next
  step), run `/summary` on the branch before the merge so the summary lands with the PR. On its own it is
  documentation: no gate, no version, no republish.
