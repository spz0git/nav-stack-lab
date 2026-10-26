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
   CI runs `npm run version:check`, which compares every other copy of the version with `src/version.json`. So the
   release commit also sets `package.json` and `package-lock.json` to `NN.0.0`, `CITATION.cff`'s `version` and
   `date-released`, and the issue templates' `vNN · date` placeholders.
3. Run the scoped gate, once: `python3 tests/run_all.py --changed`, and check that CI is green on the head (it runs
   `npm run lint`, `npm run fmt:check`, the build check and `npm test`, the Node golden test, on every push). The
   scoped gate reads the files changed since `origin/main` and runs only what they need: `smoke.py` (about 40 s: every
   tab on every level at three widths, Analyze, Learn, a short run) for any change to the page, then the tests of the
   areas touched, from the table `SCOPE` in `tests/run_all.py` (a core change: the L1–L5 regression `test.py` and every
   Try button `p5test.py`, plus the subsystem's own test; a lesson: `tles.py` and `p5test.py`; a chapter: `chtest.py`;
   a CSS or layout change: the smoke test alone). A change to the build or the test harness runs all eleven (about
   twelve minutes). `--changed --list` prints the choice and the files behind it. The L1–L5 summary of `test.py` must
   not change unless the change intends it. If a script fails, fix it and rerun what failed. The full suite runs
   every night on `main` (below), which catches what a scope missed; when it does, fix it first, and widen `SCOPE` so
   the next change like it runs the test.
4. Merge. Do not run the gate again on `main`: its tree is the branch that was tested. Only if something else landed
   on `main` since, bring the branch up to date first and run the scoped gate there. Pages deploys on its own when it is
   turned on (`PAGES_ENABLED`, above). The full browser suite runs nightly and on demand
   (`.github/workflows/browser-tests.yml`, Actions → Browser tests → Run workflow).
   Tag the release on the merge commit: `git tag v<NN> <merge commit> && git push origin v<NN>`.
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
