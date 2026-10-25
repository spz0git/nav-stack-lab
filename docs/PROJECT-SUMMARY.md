---
format: 2
project: nav-stack-lab
title: Nav Stack Lab
kind: code
source: https://github.com/spz0git/nav-stack-lab
commit: b11732a
updated: 2026-10-25
status: active
stage: v66 released 2026-10-24; the safety lab is complete; an audit on 2026-10-25 found the gate green and a short list of fixes to make before the next feature track
next_action: Claude works through Phase A of docs/assessment-2026-10-25.md (ten PR-sized fixes, about a week: three parameter-boundary bugs in the core, one phone console error, two lessons that cannot be completed, the noise-letter convention, three tests that print instead of fail); Spy confirms the 33 clause numbers in parallel
blocked_on: nothing
confidential: false
---

# Nav Stack Lab

## What it is
A robot navigation simulator and course that runs in the browser as one offline HTML file. It is for students and engineers learning how localization, perception, planning, control and safety standards fit together. The repo is private. The live page is a claude.ai artifact (https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7). A GitHub Pages demo is built but stays off until the repo goes public.

## Status
- Released at v66 (2026-10-24): safety lab phase 4b, the ODD monitor and a live GSN safety argument kept in the browser (lesson 9). v64–v65 the same day: learned-block monitors, a radar brake, risk rates (lessons 6–8).
- Audited on 2026-10-25 (docs/assessment-2026-10-25.md): everything the v29 plan asked for has landed except the live simulation in a worker. The whole gate passes from a fresh clone (lint, format, 62 Node tests, eleven browser tests, 224 Try buttons). Found: a negative latency from a link freezes the page, the fault schedule skips costly effects, level settings bypass validation, one reproducible console error on the phone, two lessons whose self-check can never pass, the Q/R noise letters contradicted in three places, three gate checks that print instead of fail, docs and versions still quoting v36.
- Testing is scoped since 2026-10-23: a PR runs a 40 s smoke test plus the tests of the areas it touches; the full 12-minute suite runs nightly and has been green.
- Waiting on Spy: confirming 33 unchecked clause numbers (the audit names the five to start with); whether to go public or stay private; the next feature track once the fixes land.

## Features and scope
- Three modes: Simulate, Analyze (Bode, Nyquist, poles, LQR) and Learn.
- 54 lessons in five groups (control, localization, perception, planning, safety) and 9 chapters with derivations.
- Vehicles from a unicycle to a dynamic car with tyre slip, plus actuation imperfections.
- Sensors in their own tab: odometry, gyro, lidar, beacons, GNSS, sonar ring and radar, with noise profiles, weather, a switchboard and a fault schedule.
- Localization: EKF, particle filter, EKF-SLAM, scan matching and pose-graph SLAM.
- Planning and control: A*, RRT*, Hybrid A*, D* Lite, MPC, DWA and more, with user code slots and tested examples.
- Three learned models (detector, predictor, policy) that can be retrained in the page.
- Safety tools: contact severity, leading indicators, an ODD sheet, scenario search over generated worlds, learned-block monitors, a radar emergency brake, risk rates with intervals, an ODD monitor and a live safety argument.
- Levels stored as JSON, plus a seeded world generator.

Out of scope: runtime dependencies or network access, quoting the safety standards, and public hosting while the repo is private.

## Next big items
1. Phase A of the audit: the core parameter bugs, the phone error, the two unpassable lessons, the noise letters, the printing tests, the wrapping chips — Claude · about a week, ten PRs.
2. Phase B: smoke test on every PR, a golden-file guard, one version source with tags, a UI test for the 23 untested modules, keyboard and phone gaps, the docs refresh — Claude · one to two weeks, interleaved with features.
3. Confirm the 33 clause numbers the safety lessons cite, starting with the five the audit flags — Spy · an hour with the standards.
4. Pick the next track from the roadmap: more sensors, environments, or the learning tracks — Spy · a decision.
5. Go public (make the repo public and turn Pages on) — Spy · a decision.
