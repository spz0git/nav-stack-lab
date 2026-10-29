---
format: 2
project: nav-stack-lab
title: Nav Stack Lab
kind: code
source: https://github.com/spz0git/nav-stack-lab
commit: 04c30b2
updated: 2026-10-29
status: active
stage: v70 (2026-10-29) answers Spy's review comments on the live page: safety lesson 2 rebuilt around a worked hazard analysis of the busy floor
next_action: Spy pushes the v67–v70 release tags (the session's proxy refuses tag pushes with HTTP 403) and picks the next track: the live simulation in a worker (about a week) or a feature track
blocked_on: nothing
confidential: false
---

# Nav Stack Lab

## What it is
A robot navigation simulator and course in one offline HTML file, for students and engineers learning how localization, perception, planning, control and safety standards fit together. The repo is private; the live page is a claude.ai artifact (https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7). GitHub Pages stays off until the repo goes public.

## Status
- v70 (2026-10-29) answers Spy's live-page comments: safety lesson 2 gets defined symbols, severity and integrity tables, L5's hazard log and controllability beside the robot's avoidance margin; near answers count; the level menu shows more below.
- v69 (2026-10-26) closed Phase C of the 2026-10-25 audit; only the live simulation in a worker remains of that plan.
- Testing: CI on every PR, the scoped gate before each merge, the full suite of twelve nightly.
- Release tags: none on the remote yet (v67–v70); the session's git proxy refuses tag pushes (HTTP 403). The superseded PRs #139, #141 and #142 are closed.
- Waiting on Spy:
  - pushing the v67–v70 tags;
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
2. Confirm the 33 clause numbers the safety lessons cite, the five the audit flags first — Spy · an hour.
3. Push the v67–v70 release tags from a machine whose git can push tags — Spy · minutes.
4. Pick the next track: sensors, environments, or the learning tracks — Spy · a decision.
5. Go public and turn Pages on — Spy · a decision.
