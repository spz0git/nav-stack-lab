---
format: 2
project: nav-stack-lab
title: Nav Stack Lab
kind: code
source: https://github.com/spz0git/nav-stack-lab
commit: fcd710e
updated: 2026-10-24
status: active
stage: v65 released 2026-10-24; safety lab phases 1 to 3 and 4a built (8 of 9 safety lessons; risk rates, learned-block monitors, radar brake); phase 4b next
next_action: Claude builds safety lab phase 4b: the ODD monitor, the GSN safety argument with live evidence, browser storage, lesson 9
blocked_on: nothing
confidential: false
---

# Nav Stack Lab

## What it is
A robot navigation simulator and course that runs in the browser as one offline HTML file. It is for students and engineers learning how localization, perception, planning, control and safety standards fit together. The repo is private. The live page is a claude.ai artifact (https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7). A GitHub Pages demo is built but stays off until the repo goes public.

## Status
- Released at v65 (2026-10-24): safety lab phase 4a, rates per hour with intervals, importance sampling and leading indicators (lesson 8); v64 the same day was phase 3, learned blocks under watch and a radar emergency brake (lessons 6–7).
- v62–v63 (2026-10-23): a Sensors tab and numbered pipeline tabs; v60–v61 (2026-10-22): safety lab phases 1 and 2.
- Testing is scoped since 2026-10-23: a PR runs a 40 s smoke test plus the tests of the areas it touches; the full 12-minute suite runs nightly.
- Health: the scoped tests and CI passed for v65 before its merge; nightly full runs green.
- Waiting on Spy: confirming 33 unchecked clause numbers (not blocking); whether to go public or stay private. Decision 4 settled 2026-10-24: Safety stays a Learn group plus Tools tab.

## Features and scope
- Three modes: Simulate, Analyze (Bode, Nyquist, poles, LQR) and Learn.
- 53 lessons in five groups (control, localization, perception, planning, safety) and 9 chapters with derivations.
- Vehicles from a unicycle to a dynamic car with tyre slip, plus actuation imperfections.
- Sensors in their own tab: odometry, gyro, lidar, beacons, GNSS, sonar ring and radar, with noise profiles, weather, a switchboard and a fault schedule.
- Localization: EKF, particle filter, EKF-SLAM, scan matching and pose-graph SLAM.
- Planning and control: A*, RRT*, Hybrid A*, D* Lite, MPC, DWA and more, with user code slots and tested examples.
- Three learned models (detector, predictor, policy) that can be retrained in the page.
- Safety tools: contact severity, leading indicators, an ODD sheet, scenario search over generated worlds, learned-block monitors, a radar emergency brake, and risk rates with intervals.
- Levels stored as JSON, plus a seeded world generator.

Out of scope: runtime dependencies or network access, quoting the safety standards, and public hosting while the repo is private.

## Next big items
1. Safety lab phase 4b: the ODD monitor, the GSN safety argument with live evidence, browser storage for sheets, sets and arguments, lesson saf/09 — Claude · one release.
2. Confirm the 33 clause numbers the safety lessons cite as unchecked — Spy · an hour with the standards.
3. Go public (make the repo public and turn Pages on) — Spy · a decision.
