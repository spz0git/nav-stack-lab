---
format: 2
project: nav-stack-lab
title: Nav Stack Lab
kind: code
source: https://github.com/spz0git/nav-stack-lab
commit: c24e51a
updated: 2026-10-22
status: active
stage: v61 released 2026-10-22; safety lab phases 1 and 2 built (5 of 9 safety lessons, Tools → Safety)
next_action: Spy decides whether Safety stays a Learn group plus Tools tab or becomes its own mode, then Claude builds safety lab phase 3
blocked_on: nothing
confidential: false
---

# Nav Stack Lab

## What it is
A robot navigation simulator and course that runs in the browser as one offline HTML file. It is for students and engineers learning how localization, perception, planning, control and safety standards fit together. The repo is private. The live page is a claude.ai artifact (https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7). A GitHub Pages demo is built but stays off until the repo goes public.

## Status
- Released at v61 (2026-10-22): safety lab phase 2 (fault schedule, health lights in the core, people who wait for the robot, Tools → Safety with scenario search). v60, released the same day, was phase 1.
- Since v61 only documentation has landed: the project summary and the `/summary` command (PRs #121–#124).
- Health: the full browser gate passed for v61 before its merge; CI passes on `main` at `c24e51a`; the Pages deploy is skipped by design.
- Open PR #98 (2026-10-18) duplicates a fix already on `main` and needs closing.
- Waiting on Spy: whether Safety becomes its own mode (decision 4, due now that phase 2 is done); confirming 33 unchecked clause numbers (no longer blocking); whether to go public or stay private.

## Features and scope
- Three modes: Simulate (map, plots, event log, metrics, run comparison, phone layout), Analyze (Bode, Nyquist, poles, LQR) and Learn.
- 50 lessons in five groups (control, localization, perception, planning, safety) and 9 chapters with derivations.
- Vehicles from a unicycle to a dynamic car with tyre slip, plus actuation imperfections.
- Sensors: odometry, gyro, lidar, beacons, GNSS, sonar ring and radar, with weather, a switchboard and a fault schedule.
- Localization: EKF, particle filter, EKF-SLAM, scan matching and pose-graph SLAM.
- Planning and control: A*, RRT*, Hybrid A*, D* Lite, MPC, DWA and more, with user code slots and tested examples.
- Three learned models (detector, predictor, policy) that can be retrained in the page.
- Safety tools: contact severity, leading indicators, an ODD sheet and scenario search over generated worlds.
- Levels stored as JSON, plus a seeded world generator.

Out of scope: runtime dependencies or network access, quoting the safety standards, and public hosting while the repo is private.

## Next big items
1. Decide whether Safety becomes its own mode — Spy · a decision.
2. Safety lab phase 3: per-slice metrics for the learned blocks, an out-of-distribution score, an opt-in radar emergency brake, and lessons saf/06–07 — Claude · one release.
3. Housekeeping with the next release: close PR #98 and fix the stale status line in `docs/safety-lab.md` (it still says "design only, nothing built") — Claude · minutes.
4. Safety lab phase 4: rates with intervals, a GSN editor, browser storage for sheets and sets, and lessons saf/08–09 — Claude · one or two releases.
5. Go public (make the repo public and turn Pages on) — Spy · a decision.
