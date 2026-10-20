# Maintaining Nav Stack Lab

What a maintainer does that a contributor does not: cut a release, keep the demo and the live artifact in step with
`main`, and keep the regression baseline honest. [CONTRIBUTING.md](../CONTRIBUTING.md) has the rules every PR follows.

## Where the page is served

- **GitHub Pages**, https://spz0git.github.io/nav-stack-lab/, is the public demo once it is turned on; it is off
  while the repository is private (on a free plan Pages needs a public repository). A workflow deploys `dist/` from
  `main` on every push (`.github/workflows/pages.yml`: `nav-stack-lab.html` is served as `index.html` and under its
  own name, with `core-worker.js` beside it), so merging a PR updates the demo; nothing to do by hand. The job is
  opt-in: it runs only when the repository variable `PAGES_ENABLED` is `true`, and is skipped otherwise. To turn the
  demo on: make the repository public (or use a plan with private Pages), set Settings → Pages → Source: GitHub
  Actions, add the variable (Settings → Secrets and variables → Actions → Variables), then run Deploy demo once from
  the Actions tab.
- **The claude.ai artifact**, https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7, is the page the owner opens on
  desktop and phone. It is republished by hand (below). The artifact host wraps the page in its own document
  skeleton, so inside it the Content-Security-Policy meta is ignored (one console notice) and `lang` is merged onto
  the host's root element; everything else behaves as on Pages.

## Releasing (every change that lands on `main`)

The tests run once per change, right before the merge: one person works on the project, so running them on the branch
while working and again on `main` after the merge only repeats them.

1. On the branch, while working: `./build.sh`, look at the change in the page, and commit the rebuilt `dist/` with
   each source change so page and commit match. Add a line to `CHANGELOG.md` under `## Unreleased` and, for a
   feature, a section to `docs/roadmap.md`. The page shows the changelog under the version label (What's new), so
   write each entry for someone who uses the page. The repository is the only reference: there are no copies of the
   roadmap elsewhere to keep in sync. No test gate yet. Open a PR; on every push CI (`.github/workflows/ci.yml`)
   builds, checks that the committed `dist/` equals a fresh build, and runs the Node golden tests.
2. When the PR is ready to merge, make the release commit on the branch: in `src/version.json` set `version` to the
   artifact version the next publish will create (the previous publish's version + 1), with `date` and a short
   `note`; rename `## Unreleased` to `## vNN · date` in `CHANGELOG.md`; rebuild and commit. The label in the header
   (`v30 · 2026-10-15`) is the one users quote in bug reports, and this way it matches the artifact's version history.
3. Run the gate, once: `npm run lint`, `npm run fmt:check`, `npm test` (the Node golden test, 10 s) and
   `python3 tests/run_all.py` (the eight browser tests: `test.py`, `p5test.py`, `tles.py`, `chtest.py`, `dyntest.py`,
   `extest.py`, `trtest.py`, `sntest.py`). The L1–L5 summary of `test.py` must not change unless the change intends it;
   `p5test`, `chtest` and `dyntest` must report no errors. If a script fails, fix it and rerun what failed (the whole
   gate when the fix touches shared code).
4. Merge. Do not run the gate again on `main`: its tree is the branch that was tested. Only if something else landed
   on `main` since, bring the branch up to date first and run the gate there. Pages deploys on its own when it is
   turned on (`PAGES_ENABLED`, above). The browser gate also runs nightly and on demand
   (`.github/workflows/browser-tests.yml`, Actions → Browser tests → Run workflow).
5. Republish the live artifact from `dist/nav-stack-lab.html` to the URL above with downloads enabled, and check that
   the Version in the publish result equals `src/version.json`. While a PR is open the live artifact is not touched;
   a "preview" is a separate, new artifact of the branch's `dist/`.
6. Delete the previous "Nav Stack Lab" page artifacts (PR previews and older builds), never the live one and never
   artifacts with other titles.

A change that leaves `dist/` as it is (documentation outside the lessons, chapters and changelog; CI files) needs no
gate, no version and no republish.

## The regression baseline

`tests/test.py` prints the L1–L5 summary (goals reached, skipped, contacts, mission time, pose error, NEES) for the
documented configurations. It has been byte-identical, plan-time milliseconds excluded, since v16; every PR that
touches `core/` compares before and after. The Node golden test (`tests/node/golden.test.mjs`) asserts the same numbers against a committed JSON with tolerances, so CI catches a drift without a
human reading the printout. When a change intends a new baseline, regenerate the JSON in the same PR (`npm run golden`) and say why.

Lesson numbers ("What you will see") are single seed-7 runs measured with the `tests/measure_*.py` scripts; a change
in the core that moves them is a content change too, and the lesson text is updated in the same PR.

## Screenshots and history

Before-and-after screenshots at 1440 × 900 and 390 × 844 (light and dark) accompany UI PRs in the PR description,
not in the tree: `docs/screenshots/` was removed from the repository in the release series because it weighed 40 MB.
`tests/shots.py` and `tests/shots_dyn.py` generate them into a folder you choose.

`legacy/` (the patch scripts the single file was grown with before the split into modules, v1–v7) was removed at the
same time; it is in the git history up to that commit.
