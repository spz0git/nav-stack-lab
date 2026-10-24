---
format: 2
project: nav-stack-lab
title: Nav Stack Lab
kind: code
source: https://github.com/spz0git/nav-stack-lab
commit: fcd710e
updated: 2026-10-24
status: active
stage: v66 released 2026-10-24; the safety lab is complete (all four phases, 9 safety lessons, Tools → Safety with search, risk, ODD monitor and a live safety argument)
next_action: Spy confirms the 33 clause numbers the safety lessons cite, then picks the next track (sensors, environments, or going public)
blocked_on: nothing
confidential: false
---

# Nav Stack Lab

## What it is
A robot navigation simulator and course that runs in the browser as one offline HTML file. It is for students and engineers learning how localization, perception, planning, control and safety standards fit together. The repo is private. The live page is a claude.ai artifact (https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7). A GitHub Pages demo is built but stays off until the repo goes public.

## Status
- Released at v66 (2026-10-24): safety lab phase 4b, the ODD monitor and a live GSN safety argument with arguments, sheets and sets kept in the browser (lesson 9). v64–v65 the same day: learned-block monitors, a radar brake, risk rates (lessons 6–8).
- v62–v63 (2026-10-23): a Sensors tab and numbered pipeline tabs; v60–v61 (2026-10-22): safety lab phases 1 and 2.
- Testing is scoped since 2026-10-23: a PR runs a 40 s smoke test plus the tests of the areas it touches; the full 12-minute suite runs nightly.
- Health: the full browser suite and CI passed for v66 before its merge; nightly full runs green.
- Waiting on Spy: confirming 33 unchecked clause numbers; whether to go public or stay private; the next track.

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
1. Confirm the 33 clause numbers the safety lessons cite as unchecked — Spy · an hour with the standards.
2. Pick the next track from the roadmap: more sensors (a camera, weather-dependent noise), environments (a wall editor, lessons on generated worlds), or the learning tracks — Spy · a decision.
3. Go public (make the repo public and turn Pages on) — Spy · a decision.
