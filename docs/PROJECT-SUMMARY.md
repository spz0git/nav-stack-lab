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
next_action: Claude works through Phase A of docs/assessment-2026-10-25.md (ten PR-sized fixes, about a week); Spy confirms the 33 clause numbers in parallel
blocked_on: nothing
confidential: false
---

# Nav Stack Lab

## What it is
A robot navigation simulator and course in one offline HTML file, for students and engineers learning how localization, perception, planning, control and safety standards fit together. The repo is private; the live page is a claude.ai artifact (https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7). GitHub Pages stays off until the repo goes public.

## Status
- Released at v66 (2026-10-24): the safety lab complete (ODD monitor, a live GSN safety argument, risk rates, learned-block monitors, a radar brake; lessons 6–9).
- Audited on 2026-10-25 (docs/assessment-2026-10-25.md): the v29 plan is delivered except the live simulation in a worker; the gate passes. Found: three parameter bugs in the core (one freezes the page from a link), a phone console error, two lessons whose self-check cannot pass, the Q/R letters contradicted, three gate checks that print instead of fail.
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
1. Phase A of the audit: the core bugs, the phone error, the unpassable lessons, the noise letters, the printing tests — Claude · a week, ten PRs.
2. Phase B: smoke test on every PR, a golden guard, one version source, a UI test for the untested modules, keyboard and phone gaps, docs refresh — Claude · one to two weeks.
3. Confirm the 33 clause numbers the safety lessons cite, the five the audit flags first — Spy · an hour.
4. Pick the next track: sensors, environments, or the learning tracks — Spy · a decision.
5. Go public and turn Pages on — Spy · a decision.
