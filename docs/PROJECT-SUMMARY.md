---
format: 2
project: nav-stack-lab
title: Nav Stack Lab
kind: code
source: https://github.com/spz0git/nav-stack-lab
commit: dbc6f59
updated: 2026-10-25
status: active
stage: v67 released 2026-10-26 with Phase A of the 2026-10-25 audit; Phases B and C remain
next_action: Claude works through Phase B of docs/assessment-2026-10-25.md (smoke test on every PR, a golden guard, one version source, a UI test for the untested modules, keyboard and phone gaps, the docs refresh); Spy confirms the 33 clause numbers in parallel
blocked_on: nothing
confidential: false
---

# Nav Stack Lab

## What it is
A robot navigation simulator and course in one offline HTML file, for students and engineers learning how localization, perception, planning, control and safety standards fit together. The repo is private; the live page is a claude.ai artifact (https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7). GitHub Pages stays off until the repo goes public.

## Status
- Released at v67 (2026-10-26): Phase A of the audit. v66 (2026-10-24) completed the safety lab (ODD monitor, a live safety argument, risk rates, learned-block monitors, a radar brake).
- Audited on 2026-10-25 (docs/assessment-2026-10-25.md): the v29 plan is delivered except the live simulation in a worker; the gate passes. Its Phase A (the core parameter bugs, the phone error, the two unpassable lessons, the Q/R letters, the printing gate checks) landed as v67.
- Testing: a PR runs a 40 s smoke test plus the tests of its area; the full suite runs nightly, green.
- Waiting on Spy: the 33 clause numbers; public or private; the next track.

## Features and scope
- Three modes: Simulate, Analyze (Bode, Nyquist, poles, LQR) and Learn.
- 54 lessons in five groups (control, localization, perception, planning, safety), 9 chapters with derivations.
- Vehicles from a unicycle to a dynamic car with tyre slip, with actuation imperfections.
- Sensors tab: odometry, gyro, lidar, beacons, GNSS, sonar and radar, with noise profiles, weather, a switchboard and a fault schedule.
- Localization: EKF, particle filter, EKF-SLAM, scan matching and pose-graph SLAM.
- Planning and control: A*, RRT*, Hybrid A*, D* Lite, MPC, DWA and more, with user code slots.
- Three learned models (detector, predictor, policy), retrainable in the page.
- Safety tools: contact severity, leading indicators, ODD sheet and monitor, scenario search, learned-block monitors, a radar brake, risk rates, a live safety argument.
- Levels stored as JSON, plus a seeded world generator.

Out of scope: runtime dependencies or network access, quoting the safety standards, public hosting while private.

## Next big items
1. Phase B of the audit: smoke test on every PR, a golden guard, one version source, a UI test for the untested modules, keyboard and phone gaps, docs refresh — Claude · one to two weeks.
2. Phase C: the functions over 200 lines split, the duplicated tracker merged, tests for the analysis numerics, then the live simulation in a worker — Claude · one PR each.
3. Confirm the 33 clause numbers the safety lessons cite, the five the audit flags first — Spy · an hour.
4. Pick the next track: sensors, environments, or the learning tracks — Spy · a decision.
5. Go public and turn Pages on — Spy · a decision.
