---
format: 1
project: nav-stack-lab
title: Nav Stack Lab
kind: code
source: https://github.com/spz0git/nav-stack-lab (local ~/Repos/nav-stack-lab)
commit: 177e6c5
updated: 2026-10-22
status: active
stage: v61 released; safety lab phases 1 and 2 built (5 of 9 safety lessons, Tools → Safety with scenario search)
next_action: Build safety lab phase 3 (learned blocks per slice, out-of-distribution score, opt-in radar brake; lessons saf/06 and saf/07)
blocked_on: nothing
confidential: false
---

# Nav Stack Lab

## 1. Identity
- **What:** a robot navigation simulator and course that runs in the browser as a single HTML file: offline, works on a phone, no runtime dependencies.
- **For whom:** students and engineers learning how localization, perception, planning and control interact, and now how the safety standards apply to an autonomous stack.
- **Where:** private repo `spz0git/nav-stack-lab`. Live page is a claude.ai artifact (https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7). A GitHub Pages demo is built but off, gated on the repository variable `PAGES_ENABLED`.
- **Team:** one owner; Claude Code sessions do the work on branches through PRs.
- **Licence:** MIT, with NOTICE, CITATION.cff, CODE_OF_CONDUCT, CONTRIBUTING and issue forms.
- **Process rules:** branch + PR for all work; the live artifact isn't touched while a PR is open (previews are separate artifacts). The gate runs once per change, right before merge: `npm run lint`, `npm run fmt:check`, `npm test`, `python3 tests/run_all.py` (ten browser suites); the L1–L5 regression summary must not change unless intended. The release commit bumps `src/version.json` and renames `## Unreleased` in `CHANGELOG.md`. After merge: republish the live artifact with downloads on and delete older "Nav Stack Lab" artifacts. Lesson numbers are measured headless (seed 7, checked at other seeds), never asserted. Safety lessons paraphrase the standards and never quote them.

## 2. Current state
- `main` is released at **v61** (2026-10-22), the live artifact's version. v60 (PR #119) was safety lab phase 1; v61 (PR #120) phase 2. PR #121 (2026-10-22) added this summary and the `/summary` command; documentation only.
- **Safety lab:** phases 0–2 of `docs/safety-lab.md` done. The Learn group Safety has 5 lessons (operating domain, hazards and risk, triggering conditions, faults in time, scenario search), chapter 8 Safety (§1–§7), safety measures in the core (contact speed and severity class, clearance, time to contact), a fault schedule (`P.sched`), health lights computed in the core, people who wait for the robot, and Tools → Safety (ODD sheet, check, search with refinement, scenario sets as JSON; session only until phase 4).
- **Clause numbers:** decision 2 changed on 2026-10-22: lessons cite the best available numbers, labelled as from public outlines and unchecked. 1 of 34 is confirmed (ISO 26262-2 6.4.8); the rest wait for someone with the licensed texts. No longer blocks building.
- **Health:** CI (lint, format, build, committed `dist/` equals a fresh build, Node golden tests) green on `177e6c5`. The browser gate is run before each merge per the process (inferred from the release commits; logs are not kept in the repo). The nightly browser workflow last ran 2026-10-22 08:41 UTC on PR #117's merge (before v59), green; it has not yet run on v61.
- **Open PRs:** #98 (2026-10-18, a level-menu scroll fix whose change is already on `main`). No open issues.
- Pace: v1 on 2026-10-03 to v61 on 2026-10-22, ~121 PRs.
- Running cost: none beyond the owner's Claude plan (no hosting while Pages is off).

## 3. What exists
- Three modes: **Simulate** (map, timeline, signal plots, event log with a Metrics list including safety rows, health lights, kept runs with compare, command palette, phone layout), **Analyze** (Bode, Nyquist, step response, draggable poles, LQR and pole placement, checked against the nonlinear sim), **Learn** (50 lessons in five groups: control 18, localization 9, perception 10, planning 8, safety 5; 9 chapters with derivations; Try buttons, Predict questions, Check yourself, "Edit and run").
- Vehicles: unicycle, kinematic car, dynamic car with tyre slip; actuation latency, saturation, lag, limits, bias.
- Sensors: odometry, gyro, 120-beam lidar, beacons, GNSS, 8-sonar ring, forward radar with Doppler; weather; a switchboard with graceful degradation; any setting can change mid-run on the fault schedule.
- Localization: dead reckoning, EKF, particle filter, EKF-SLAM, scan matching, pose-graph SLAM; NEES.
- Perception and agents: occupancy mapping, costmap, people tracker with radar fusion, learned detector and three-mode predictor; scripted, reacting and triggered people.
- Planning and control: A*, RRT*, Reeds–Shepp, Hybrid A*, space-time A*, D* Lite, frontier exploration, velocity obstacles, mission FSM, a learned end-to-end policy behind a safety shield; pure pursuit, Stanley, rear-wheel feedback, PID, DWA, MPC; user code slots with 13 tested examples.
- Safety tooling: per-contact impact speed and severity class, leading indicators, health-light first-amber/red times, ODD sheet check, scenario search over generated worlds (in the page's workers and in Node, `tools/search.mjs`), scenario sets.
- Levels as data (JSON import/export, links, IndexedDB) plus a seeded world generator up to 48 × 32 m; seven built-in levels L1–L7.
- Three learned models (detector 71 KB, predictor 69 KB, policy 765 KB) trained in PyTorch (`training/`), retrainable in the page (Tools → Train).
- Stack: plain JavaScript, ~95 source files (~30,000 lines, slot examples included) concatenated by `build.mjs` into `dist/nav-stack-lab.html` (4.5 MB) + `core-worker.js` (1.4 MB); `src/core/` never touches the DOM and also runs in Workers and Node.

## 4. Plan
| Phase | What | State |
|---|---|---|
| Assessment Phases 0–3 | Standalone build, licence, CI, golden tests; learning path; workspace polish; code health | Done (v32–v36, 2026-10-16) |
| Assessment Phase 4 | Content expansion and the learning tracks (classical, modular learned, end-to-end) | Part A done (v37–v39); learning tracks begun (v40 onward), continuing |
| Feature tracks | Sensors, environments, agents, localization, planning, control, vehicle dynamics | Ongoing; candidate list in `docs/roadmap.md` |
| Safety lab 0 | Design and decisions (`docs/safety-lab.md` §9) | Done 2026-10-22; clause check (§10) open but no longer blocking |
| Safety lab 1 | Safety measures in the core, `saf` group, chapter 8, metrics; lessons saf/01–03 | Done, v60 (2026-10-22) |
| Safety lab 2 | Fault schedule, health in the core, triggered people, Tools → Safety with search; lessons saf/04–05 | Done, v61 (2026-10-22) |
| Safety lab 3 | Learned blocks per slice, out-of-distribution score, radar emergency brake as opt-in mitigation; lessons saf/06–07 | Next |
| Safety lab 4 | Rates with intervals, importance sampling, SPI chart, GSN editor and evidence runner, browser storage for sheets and sets, ODD monitor (off by default); lessons saf/08–09 | Planned |
| Go public | Public repo, Pages demo, issue tracker, file the 9 drafted good first issues | Owner decision |

## 5. Next steps
1. **Decide whether Safety becomes its own mode** (decision 4 says revisit after phase 2, which is now done) — Spy · a decision · before phase 3's page work.
2. **Safety lab phase 3:** per-slice metrics for the detector, predictor and policy; an out-of-distribution score from the training runs; the radar emergency brake as an opt-in mitigation; lessons saf/06 (learned blocks) and saf/07 (mitigations and their cost); default runs unchanged — Claude · one release · after step 1 or with the current Learn group + Tools layout.
3. **Housekeeping, batched with the next release:** close PR #98 (its fix is on `main`); update the stale status line at the top of `docs/safety-lab.md` ("design only, nothing built"); refresh the CHANGELOG header's example label (`v54`) — Claude · minutes.
4. **Confirm the clause numbers** in `docs/safety-lab.md` §10 when the licensed texts are at hand; a correction changes the row and every place it is cited — Spy · a few hours · no deadline. Also useful prep for Spy's own safety-standards gap.
5. **Safety lab phase 4** (section 4) — Claude · one or two releases · after phase 3.
6. **Decide: go public or stay private** — Spy · a decision · any time.
7. **Later:** the other feature tracks (generated worlds and policy retraining, live simulation in a Web Worker, the next sensor) wait behind the safety track.

## 6. Decisions waiting on Spy
| Decision | Blocks | Notes |
|---|---|---|
| Safety: Learn group plus Tools tab, or its own mode | Phase 3's page layout (it can proceed as is) | Decision 4: revisit after phase 2, which shipped in v61 |
| Confirm the 33 unchecked clause citations (`docs/safety-lab.md` §10) | Nothing now; lessons cite them labelled unchecked | Only ISO 26262-2 6.4.8 confirmed, from a public contents page |
| Go public (repo public, `PAGES_ENABLED=true`) | Demo, issue tracker, contributors, the 9 good first issues | If private, skip the release polish |
| PR #98: close or salvage its test | Housekeeping | The CSS fix is already on `main` |
| Lidar safety stop on by default | Default runs and the L1–L5 regression | Phase 3 builds its tuning as an opt-in mitigation (decision 7) |

## 7. Risks and known issues
- Fixed cost per change (rebuild, lesson measurements, gate, version bump, republish, artifact cleanup): batch small changes.
- Page size: 4.5 MB against the ~4.65 MB accepted for the safety track (decision 5); phases 3 and 4 must fit the rest, and a fourth model would want the lighter model export. `.git` grows with every committed `dist/`.
- Lesson numbers are tied to the core's behaviour: a core change that moves them is also a content change. The fault schedule and the health checks now live in the core, so changes there touch the safety lessons too.
- Parallel branches have collided before (radar, sonar, GNSS): coordinate concurrent sessions.
- Safety lab: copyright (paraphrase, never quote), 33 clause numbers unchecked against the licensed texts, road-vehicle standards applied to small robots (lesson 1 says so). Tools → Safety's sheets and scenario sets are lost on reload until phase 4's browser store.
- Safety findings the lessons teach (not defects to fix): the lidar loss is detected in 0.5 s but nothing reacts; a weakened motor is never detected; ODD-1 has a contact in about 2 of 5 generated warehouses.
- Known limits: kept runs live in memory only; health thresholds are heuristics; NEES and the phantom rule use ground truth; MPC treats people as static and doesn't pre-steer through cusps; no GNSS in SLAM or the particle filter; no sensor materials; generated levels are diff-drive only and imports aren't checked for reachability; a generated level's link is its spec, so generator changes alter old links; the 48 × 32 m warehouse with unlabeled beacons loses the particle filter on half the seeds; the learned policy fails at corners and doorways; live simulation still on the main thread.
- Small inconsistencies: `docs/safety-lab.md` status line is stale; the CHANGELOG header's example is `v54`; `package.json` version 36.0.0 is unrelated to the page version.

## 8. Success metrics
None defined. Proxies available today: the L1–L5 regression summary, the measured lesson numbers, and for the safety track the contact rate of a search over ODD-1 (8–9 of 20 random worlds at v61).

## 9. Links to other projects
- **org-stack-lab:** the engineering-leadership simulator and course built on this lab's process and code (copied, never imported).
- **steps:** the safety lab overlaps with Spy's own safety-standards prep (SOTIF, ISO/PAS 8800, safety cases).

## 10. Where to look
`docs/safety-lab.md` (safety track design, phases, decisions, clause table) · `docs/roadmap.md` (design notes per feature, known limits, candidate next steps) · `docs/maintaining.md` (release procedure) · `CHANGELOG.md` (what each version changed) · `docs/assessment-2026-10-15.md` (assessment and phased plan) · `docs/good-first-issues.md` · `CONTRIBUTING.md` · `src/README.md` (source map) · `CLAUDE.md` (working rules and the gate).
