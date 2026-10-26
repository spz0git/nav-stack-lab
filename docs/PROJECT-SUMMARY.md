---
format: 2
project: nav-stack-lab
title: Nav Stack Lab
kind: code
source: https://github.com/spz0git/nav-stack-lab
commit: 695cee6
updated: 2026-10-25
status: active
stage: v69 released 2026-10-26 with Phase C of the 2026-10-25 audit; the audit's plan is done except the live simulation in a worker
next_action: Spy tags v67 (dbc6f59), v68 (7a8b660) and v69 (695cee6) by hand (the session's git proxy refuses tag pushes), confirms the 33 clause numbers, and picks what comes next: the live simulation in a worker (about a week) or a feature track
blocked_on: nothing
confidential: false
---

# Nav Stack Lab

## What it is
A robot navigation simulator and course in one offline HTML file, for students and engineers learning how localization, perception, planning, control and safety standards fit together. The repo is private; the live page is a claude.ai artifact (https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7). GitHub Pages stays off until the repo goes public.

## Status
- Released at v69 (2026-10-26): Phase C of the audit; v67 and v68 the same day: Phases A and B. v66 (2026-10-24) completed the safety lab.
- Audited on 2026-10-25 (docs/assessment-2026-10-25.md): the v29 plan is delivered except the live simulation in a worker; the gate passes. Phases A, B and C landed as v67–v69: no core function over 200 lines, one tracker lifecycle, numerics tests, the page 4.7 → 3.8 MB, lesson run logs as tables. Only the live simulation in a worker remains.
- Testing: CI runs lint, format, build, the version check, the Node tests and the smoke test on every PR (2 min); the scoped gate adds the area's tests; the full suite of twelve runs nightly, green.
- Waiting on Spy: the v67–v69 tags; the 33 clause numbers; public or private; the next track.

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
1. The live simulation in a worker, the audit's last item: a render-only mirror of the state and a message protocol the tests also move to — Claude · about a week, its own phase.
2. Confirm the 33 clause numbers the safety lessons cite, the five the audit flags first — Spy · an hour.
3. Pick the next track: sensors, environments, or the learning tracks — Spy · a decision.
4. Go public and turn Pages on — Spy · a decision.
