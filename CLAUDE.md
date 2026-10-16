# Nav Stack Lab — working notes for Claude

- Single-page artifact built from `src/` by `./build.sh` (runs `node build.mjs`); `dist/nav-stack-lab.html` is a complete standalone document (the tests load it directly) with the fonts embedded (`src/fonts/`), so it makes no network request at runtime.
  Modules share one scope, concatenated in `src/manifest.json` order; `core/` never touches the DOM (UI hooks in `core/state.js`).
  To look at the built page in the desktop app's browser pane, `.claude/launch.json` serves the repo on port 8765
  (`preview_start` name `dist`, then open `/dist/nav-stack-lab.html`).
- Published artifact: https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7 (the live page; the owner opens it on desktop and phone).
  The public demo is GitHub Pages (https://spz0git.github.io/nav-stack-lab/, deployed from `main` by a workflow). The full
  release procedure is in `docs/maintaining.md`; the rules below are the short form.
  Commit the rebuilt `dist/` with every source change so artifact and commit match.
- Publishing rules:
  - Work on a branch and open a PR. While it is open, do not touch the live artifact; when asked to "preview", publish
    `dist/nav-stack-lab.html` as a separate new artifact and give its link.
  - Whenever a change lands on `main` in this session (you merge a PR or push to main), rebuild, run the tests below,
    and republish `dist/nav-stack-lab.html` to the live artifact URL above with `capabilities: {downloads: true}`.
    Say in your reply that the live page was updated.
  - The header shows the version from `src/version.json` (`v25 · 2026-10-14`). Before each republish of the live artifact,
    set `version` to the artifact version the publish will create (the last publish result's version + 1), with the date
    and a short note, rebuild, and commit it; the label then matches the artifact's version history.
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
- Lessons are markdown in `docs/lessons/<group>/*.md` (format in the header of `tools/lessons.mjs`; the build inlines them as
  `LESSON_DATA`): a `## Try: Label` section per experiment with `cfg:`, `Setup:`, `See:`, `Shows:`, `Predict:` + options + `Answer:`;
  `## Think about` Q:/A: pairs; `## Check yourself`. Their terms stay in `LESSON_TERMS` (`src/analysis/glossary.js`), keyed by title. Numbers in a lesson's "What you will see" are measured headless first
  (`tests/measure_loc.py` for localization, `tests/measure_per.py` for perception, `tests/measure_plan.py` for planning, which can press a Try button's cfg exactly; `tests/measure_dyn.py` for the car with tyre slip, which presses every Try of a control lesson by title; `tests/tles.py` prints the analysis numbers for the control lessons); derivations go in the chapter, the lesson keeps a short "where it comes from" and the link.
- Before committing: `./build.sh`, then from `tests/`: `python3 test.py` (L1–L5 regression summary must not change unless
  intended), `python3 p5test.py` (all Try buttons, ERRORS must be []), `python3 tles.py` (lessons), `python3 chtest.py` (companion notes),
  `python3 dyntest.py` (the car with tyre slip against chapter 1's theory, Analyze against the simulator; FAILS must be []),
  `python3 extest.py` (every slot example against its built-in; FAILS must be []). `python3 tests/run_all.py` runs all six.
- Design notes, known limits and next steps live in `docs/roadmap.md`. The GitHub repo is the only reference: there are
  no copies elsewhere (Claude projects, docs) to keep in sync.
