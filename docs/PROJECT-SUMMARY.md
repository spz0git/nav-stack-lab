---
format: 2
project: nav-stack-lab
title: Nav Stack Lab
kind: code
source: https://github.com/spz0git/nav-stack-lab
commit: d5939c5
updated: 2026-10-31
status: active
stage: v76 (2026-10-31) completes the prose audit before open-sourcing: all 54 lessons (v72, v75) and all 9 chapters (v76) read as written by an engineer
next_action: Spy spot-reads a few lessons and a chapter on the live page, then sets the date to go public
blocked_on: nothing
confidential: false
---

# Nav Stack Lab

## What it is
A robot navigation simulator and course in one offline HTML file, for students and engineers learning how localization, perception, planning, control and safety fit together. The repo is private; the live page is a claude.ai artifact (https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7). GitHub Pages stays off until the repo goes public.

## Status
- v76 (2026-10-31): the nine chapters rewritten in plain prose, with eight statements corrected against the code or a headless measurement (the latency shift, the space-time step, the velocity-obstacle count, the chamfer error, the radar ellipse, the lookahead oscillation, the LQR damping). The prose audit is complete.
- v75 (2026-10-31): the 45 lessons on control, localization, perception and planning rewritten in plain prose, every number, table and experiment unchanged; four small factual slips fixed.
- v74 (2026-10-31), after Spy's feedback: search and argument Trys show their results in the lesson, a red claim lists the runs against it, and Open plays a run up to its contact.
- v72 and v73 (2026-10-30 and 31): the nine safety lessons rewritten in plain prose, and a fix to lesson 8's last prediction.
- Testing: CI on every PR, the scoped gate before each merge, the full suite nightly; each merged version is tagged and published as a GitHub Release.
- Waiting on Spy: a spot-read of the rewritten lessons and chapters; one click on each of the four standards links (checked by search only); the date to go public; the next track.

## Features and scope
- Three modes: Simulate, Analyze (frequency response, poles, LQR) and Learn.
- 54 lessons in five groups (control, localization, perception, planning, safety), 9 chapters with derivations.
- Vehicles from a unicycle to a car with tyre slip and actuation imperfections.
- Sensors: odometry, gyro, lidar, beacons, GNSS, sonar and radar, with noise, weather, a switchboard and a fault schedule.
- Localization: EKF, particle filter, EKF-SLAM, scan matching and pose-graph SLAM.
- Planning and control: A*, RRT*, Hybrid A*, D* Lite, MPC, DWA and more, with user code slots.
- Three learned models (detector, predictor, policy), retrainable in the page.
- Safety tools (results shown in the lessons, each failing run one click from the map): contact severity, a worked hazard analysis, leading indicators, ODD sheet and monitor, scenario search, a radar brake, risk rates, a live safety argument.
- Levels stored as JSON, plus a seeded world generator.

Out of scope: runtime dependencies or network access, reproducing the safety standards' text or tables, public hosting while private.

## Next big items
1. Go public and turn Pages on — Spy · a decision.
2. The live simulation in a worker, the audit's last item: a render-only mirror of the state and a message protocol — Claude · about a week.
3. Pick the next track: sensors, environments, or the learning tracks — Spy · a decision.
