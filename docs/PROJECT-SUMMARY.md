---
format: 2
project: nav-stack-lab
title: Nav Stack Lab
kind: code
source: https://github.com/spz0git/nav-stack-lab
commit: eca9d81
updated: 2026-10-31
status: active
stage: v73 (2026-10-31) fixes safety lesson 8's last prediction after Spy's comment; v72 (2026-10-30) rewrote the nine safety lessons in plain prose
next_action: Spy finishes reading the rewritten safety lessons on the live page (the comments reached lesson 8 on 2026-10-31); then picks the next track
blocked_on: nothing
confidential: false
---

# Nav Stack Lab

## What it is
A robot navigation simulator and course in one offline HTML file, for students and engineers learning how localization, perception, planning, control and safety fit together. The repo is private; the live page is a claude.ai artifact (https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7). GitHub Pages stays off until the repo goes public.

## Status
- v73 (2026-10-31): safety lesson 8's last prediction asked "which of the four measures" but offered three; it now lists all four. Spy's comment on the live page found it.
- v72 (2026-10-30): the nine safety lessons rewritten in plain prose, no measured number changed; lessons 5 and 6 explained in full; the standards described without clause numbers, introduced in chapter 8 §1 with links.
- Testing: CI on every PR, the scoped gate before each merge, the full suite nightly; each merged version is tagged and published as a GitHub Release.
- Waiting on Spy: the rest of the read of the rewritten safety lessons; one click on each of the four standards links (checked by search only, the session could not open iso.org); public or private; the next track.

## Features and scope
- Three modes: Simulate, Analyze (frequency response, poles, LQR) and Learn.
- 54 lessons in five groups (control, localization, perception, planning, safety), 9 chapters with derivations.
- Vehicles from a unicycle to a car with tyre slip and actuation imperfections.
- Sensors: odometry, gyro, lidar, beacons, GNSS, sonar and radar, with noise, weather, a switchboard and a fault schedule.
- Localization: EKF, particle filter, EKF-SLAM, scan matching and pose-graph SLAM.
- Planning and control: A*, RRT*, Hybrid A*, D* Lite, MPC, DWA and more, with user code slots.
- Three learned models (detector, predictor, policy), retrainable in the page.
- Safety tools: contact severity, a worked hazard analysis, leading indicators, ODD sheet and monitor, scenario search, a radar brake, risk rates, a live safety argument.
- Levels stored as JSON, plus a seeded world generator.

Out of scope: runtime dependencies or network access, reproducing the safety standards' text or tables, public hosting while private.

## Next big items
1. Spy's second read of the safety lessons and the comments it brings — Spy · an hour, then Claude.
2. The live simulation in a worker, the audit's last item: a render-only mirror of the state and a message protocol — Claude · about a week.
3. Pick the next track: sensors, environments, or the learning tracks — Spy · a decision.
4. Go public and turn Pages on — Spy · a decision.
