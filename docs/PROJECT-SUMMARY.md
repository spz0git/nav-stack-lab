---
format: 1
project: nav-stack-lab
title: Nav Stack Lab
kind: code
source: https://github.com/spz0git/nav-stack-lab (local ~/Repos/nav-stack-lab)
commit: df4a730
updated: 2026-10-22
status: active
stage: v59 released; safety-lab track designed (docs/safety-lab.md), waiting on the owner's clause-number check
next_action: Confirm the 34 clause citations in docs/safety-lab.md section 10, then build safety-lab phase 1
blocked_on: Owner's clause-number check (safety lab only)
confidential: false
---

# Nav Stack Lab

## 1. Identity
- **What:** a robot navigation simulator and course that runs in the browser as a single HTML file: offline, works on a phone, no runtime dependencies.
- **For whom:** students and engineers learning how localization, perception, planning and control interact.
- **Where:** private repo `spz0git/nav-stack-lab`. Live page is a claude.ai artifact (https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7). A GitHub Pages demo is built but off, gated on the variable `PAGES_ENABLED`.
- **Team:** one owner; Claude Code sessions do the work on `claude/*` branches through PRs.
- **Licence:** MIT, with NOTICE, CITATION.cff, CODE_OF_CONDUCT, CONTRIBUTING and issue forms.
- **Process rules:** branch + PR for all work; the live artifact isn't touched while a PR is open (previews are separate artifacts). The gate runs once per change, right before merge: `npm run lint`, `npm run fmt:check`, `npm test` (~10 s), `python3 tests/run_all.py` (nine browser suites, ~3 min); the L1–L5 regression summary must not change unless intended. The release commit bumps `src/version.json` and renames `## Unreleased` in `CHANGELOG.md`. After merge: republish the live artifact with downloads on and delete older "Nav Stack Lab" artifacts. Lesson numbers are measured headless (seed 7, checked at other seeds), never asserted.

## 2. Current state
- `main` is released at **v59** (2026-10-22): each lesson's Predict question now asks about its own experiment (PR #113). v58 (2026-10-20) added radar and weather, the ultrasonic ring, and GNSS with the Sensors switchboard.
- **Safety lab designed** (PR #118, 2026-10-22): `docs/safety-lab.md`, a new track teaching ISO 26262, ISO 21448 (SOTIF), ISO/PAS 8800 and UL 4600 by doing them on the simulator. Design only; the owner's decisions are recorded (section 9); 34 clause citations wait for the owner's check against licensed texts (section 10).
- Pace: v1 on 2026-10-03 to v59 on 2026-10-22 — 59 releases and ~118 PRs in 20 days.
- PR #98 (older CSS fix, already on `main`): status not re-checked on 2026-10-22.
- CI on every PR and push: lint, format, build, committed `dist/` equals a fresh build, Node golden tests. Browser gate nightly and on demand.
- Small inconsistencies: README says 41 lessons (there are 45); CHANGELOG header uses `v54` as its example; `package.json` version 36.0.0 is unrelated to the page version.

## 3. What exists
- Three modes: **Simulate** (map, scrubbable timeline, signal plots, event log, health lights, kept runs with compare, command palette, phone layout), **Analyze** (Bode, Nyquist, step response, draggable poles, LQR and pole placement, checked against the nonlinear sim), **Learn** (45 lessons, 8 chapters with derivations; Try buttons, Predict questions, Check-yourself, "Edit and run" into the Code tab).
- Vehicles: unicycle, kinematic car, dynamic car with tyre slip; actuation latency, saturation, lag, limits, bias.
- Sensors: odometry, gyro, 120-beam lidar, beacons, GNSS, 8-sonar ring, forward radar with Doppler; weather degrades the lidar; switchboard with graceful degradation.
- Localization: dead reckoning, EKF, particle filter, EKF-SLAM, scan matching, pose-graph SLAM; NEES.
- Perception: occupancy mapping, costmap, people tracker with radar fusion, learned detector and three-mode predictor.
- Planning: A*, RRT*, Reeds–Shepp, Hybrid A*, space-time A*, D* Lite, frontier exploration, velocity obstacles, mission FSM, learned end-to-end policy behind a safety shield.
- Control: pure pursuit, Stanley, rear-wheel feedback, PID, DWA, MPC (NMPC/LTV, tyre-model); user code slots for controller, planner, localizer, predictor (13 tested examples).
- Levels as data (JSON import/export, links, IndexedDB) plus a seeded world generator up to 48 × 32 m; seven built-in levels L1–L7.
- Three learned models (detector 71 KB, predictor 69 KB, policy 765 KB) trained in PyTorch (`training/`), retrainable in the page (Tools → Train).
- Stack: plain JavaScript, ~77 modules (~29,000 lines) concatenated by `build.mjs` into `dist/nav-stack-lab.html` (~4.2 MB) + `core-worker.js`; `src/core/` never touches the DOM and also runs in Workers and Node.

## 4. Plan
| Phase | What | State |
|---|---|---|
| Assessment Phase 0 | Standalone build, fonts, licence files, CI, golden tests, Prettier, markdown lessons, Predict questions, Code-tab examples | Mostly done |
| Assessment Phases 1–3 | Learning path and progress, "Start here", workspace polish, code health | Not re-audited against v58 |
| Feature tracks | Sensors, environments, agents, localization, planning and control, safety, engineering, learning tracks | Ongoing; see `docs/roadmap.md` |
| Safety lab 0 | Design, decisions (9), clause numbers confirmed (10) | Design and decisions done 2026-10-22; clause check open |
| Safety lab 1 | Vocabulary on what exists: `saf` group, glossary, safety chapter (Notation → ch. 9), new Experiments metrics; lessons saf/01, 02, 04 | Next |
| Safety lab 2 | Faults in time (switchboard mid-mission, kidnap onto the core's schedule), Tools → Safety with ODD sheets and Search; lessons saf/03, 06 | Planned |
| Safety lab 3 | Learned blocks per slice, out-of-distribution score, radar emergency brake as opt-in mitigation; lessons saf/05, 07 | Planned |
| Safety lab 4 | Rates with intervals, importance sampling, SPI chart, GSN editor and evidence runner, ODD monitor; lessons saf/08, 09 | Planned |
| Go public | Public repo, Pages demo, issue tracker, file the 9 drafted good first issues | Owner decision |

## 5. Next steps
1. **Confirm the clause numbers** in `docs/safety-lab.md` section 10 (34 citations; no lesson cites one until it is confirmed) — Spy · a few hours with the standards · unblocks phase 1. Also useful prep for Spy's own safety-standards gap.
2. **Safety lab phase 1:** the `saf` Learn group, glossary, safety chapter's first sections, new Experiments metrics (impact speed, `minObs`, close-approach seconds), lessons saf/01, 02, 04; baseline unchanged — Claude · one release · after step 1.
3. **Housekeeping:** fix the README lesson count (says 41; there are 45); close or salvage PR #98 if still open — Claude · minutes · batch with the next release.
4. **Decide: go public or stay private** — Spy · a decision.
5. **Later:** safety lab phases 2–4 (section 4); the other feature tracks (generated worlds and policy retraining, live simulation in a Web Worker, the next sensor) wait behind the safety track.

## 6. Decisions waiting on Spy
| Decision | Blocks | Notes |
|---|---|---|
| Confirm the 34 clause citations (`docs/safety-lab.md` §10) | Safety lab lessons | Checked so far only against public contents and secondary sources |
| Safety: Learn group plus Tools tab, or its own mode | After safety phase 2 | Decision 4 says revisit then |
| Go public (repo public, `PAGES_ENABLED=true`) | Demo, issue tracker, contributors, the 9 good first issues | If private, skip the release polish |
| PR #98: close or salvage its test | Housekeeping | The CSS fix is already on `main` |
| Lidar safety stop on by default | Default runs | The safety track builds it as an opt-in mitigation (decision 7) |

Decided 2026-10-22 (safety lab §9): only the four standards; the lab's own severity scale from contact speed; +320 KB page size accepted; arguments and ODD sheets stored in the browser; the kidnap moves onto the core's fault schedule; the ODD monitor in phase 4, off by default.

## 7. Risks and known issues
- Fixed cost per change (rebuild, lesson measurements, gate, version bump, republish, artifact cleanup): batch small changes.
- Single-file size (~4.2 MB) and the ~1 MB per-model budget cap how big learned models can get; `.git` grows with every committed `dist/`.
- Lesson numbers are tied to the core's behaviour: a core change that moves them is also a content change.
- Parallel branches have collided before (radar, sonar, GNSS): coordinate concurrent sessions.
- Safety lab: copyright (paraphrase, never quote the standards), unconfirmed clause numbers, and road-vehicle standards applied to small robots (the track says so in its first lesson). Phase 2 moves the kidnap onto the core's schedule, which re-measures three localization lessons.
- Known limits: runs live in memory only; health thresholds are heuristics; NEES and the phantom rule use ground truth; MPC treats people as static and doesn't pre-steer through cusps; no GNSS in SLAM or the particle filter; no sensor materials; generated levels are diff-drive only and imports aren't checked for reachability; a generated level's link is its spec, so generator changes alter old links; the 48 × 32 m warehouse with unlabeled beacons loses the particle filter on half the seeds; the learned policy fails at corners and doorways for lack of training data; live simulation still on the main thread.

## 8. Success metrics
None defined. Proxies available today: the L1–L5 regression summary and the measured lesson numbers.

## 9. Links to other projects
- **org-stack-lab:** the engineering-leadership simulator and course built on this lab's process and code (copied, never imported).
- **steps:** the safety lab overlaps with Spy's own safety-standards prep (SOTIF, ISO/PAS 8800, safety cases).

## 10. Where to look
`docs/safety-lab.md` (safety track design, decisions, clauses to confirm) · `docs/roadmap.md` (design notes, known limits, backlog) · `docs/maintaining.md` (release procedure) · `docs/assessment-2026-10-15.md` (v29 assessment and phased plan) · `docs/good-first-issues.md` · `CONTRIBUTING.md` · `src/README.md` (source map) · `CHANGELOG.md`.
