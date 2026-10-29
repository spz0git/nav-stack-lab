---
format: 2
project: nav-stack-lab
title: Nav Stack Lab
kind: code
source: https://github.com/spz0git/nav-stack-lab
commit: d8b2808
updated: 2026-10-29
status: active
stage: v71 (2026-10-29) answers Spy's questions on the safety lessons: the Metrics list is linked from the text, the measures defined in place, the seeds explained
next_action: Spy picks the next track: the live simulation in a worker (about a week) or a feature track
blocked_on: nothing
confidential: false
---

# Nav Stack Lab

## What it is
A robot navigation simulator and course in one offline HTML file, for students and engineers learning how localization, perception, planning, control and safety standards fit together. The repo is private; the live page is a claude.ai artifact (https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7). GitHub Pages stays off until the repo goes public.

## Status
- v71 (2026-10-29): every mention of the Metrics list in the safety lessons opens the dock and marks the row; lesson 3 defines the safety measures in place; lesson 1 explains the world seed and the run seed.
- v70 (2026-10-29): safety lesson 2 rebuilt around a worked hazard analysis of the busy floor.
- v69 (2026-10-26) closed Phase C of the 2026-10-25 audit; only the live simulation in a worker remains of that plan.
- Testing: CI on every PR, the scoped gate before each merge, the full suite of twelve nightly.
- Release tags v67–v70 are on GitHub (pushed by Spy, 2026-10-29); sessions cannot push tags (the proxy answers HTTP 403), so Spy tags releases by hand: v71 is still to tag.
- Waiting on Spy:
  - the 33 clause numbers;
  - public or private;
  - the next track.

## Features and scope
- Three modes: Simulate, Analyze (Bode, Nyquist, poles, LQR) and Learn.
- 54 lessons in five groups (control, localization, perception, planning, safety), 9 chapters with derivations.
- Vehicles from a unicycle to a dynamic car with tyre slip, with actuation imperfections.
- Sensors tab: odometry, gyro, lidar, beacons, GNSS, sonar and radar, with noise profiles, weather, a switchboard and a fault schedule.
- Localization: EKF, particle filter, EKF-SLAM, scan matching and pose-graph SLAM.
- Planning and control: A*, RRT*, Hybrid A*, D* Lite, MPC, DWA and more, with user code slots.
- Three learned models (detector, predictor, policy), retrainable in the page.
- Safety tools: contact severity, a worked hazard analysis, leading indicators, ODD sheet and monitor, scenario search, a radar brake, risk rates, a live safety argument.
- Levels stored as JSON, plus a seeded world generator.

Out of scope: runtime dependencies or network access, reproducing the safety standards' text or tables, public hosting while private.

## Next big items
1. The live simulation in a worker, the audit's last item: a render-only mirror of the state and a message protocol the tests also move to — Claude · about a week, its own phase.
2. Tag v71 on its merge commit — Spy · minutes.
3. Confirm the 33 clause numbers the safety lessons cite, the five the audit flags first — Spy · an hour.
4. Pick the next track: sensors, environments, or the learning tracks — Spy · a decision.
5. Go public and turn Pages on — Spy · a decision.
