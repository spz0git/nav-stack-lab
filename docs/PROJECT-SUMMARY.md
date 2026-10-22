---
format: 2
project: nav-stack-lab
title: Nav Stack Lab
kind: code
source: https://github.com/spz0git/nav-stack-lab
commit: ed14e78
updated: 2026-10-22
status: active
stage: v61 released 2026-10-22; safety lab phases 1 and 2 built (5 of 9 safety lessons, Tools → Safety)
next_action: Spy decides whether Safety stays a Learn group plus Tools tab or becomes its own mode, then Claude builds safety lab phase 3
blocked_on: nothing
confidential: false
---

# Nav Stack Lab

## What it is
A robot navigation simulator and course that runs in the browser as one offline HTML file, for students and engineers learning how localization, perception, planning, control and now safety standards fit together. The repo is private; the live page is a claude.ai artifact (https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7). A GitHub Pages demo is built but switched off until the repo goes public.

## Status
- Released at v61 (2026-10-22): safety lab phase 2 (fault schedule, health lights in the core, people who wait for the robot, Tools → Safety with scenario search). v60, the same day, was phase 1.
- Since v61 only documentation has landed (the project summary and `/summary` command, PRs #121 and #122).
- Health: the full browser gate runs once before each merge; CI state at `ed14e78` was not checked for this summary.
- Open PR #98 (2026-10-18) duplicates a fix already on `main`; it needs closing.
- Waiting on Spy: Safety as its own mode or not (decision 4, due after phase 2); confirming 33 unchecked clause numbers (no longer blocking); go public or stay private.

## Features and scope
- Three modes: Simulate (map, plots, event log, metrics, compare runs, phone layout), Analyze (Bode, Nyquist, poles, LQR), Learn.
- 50 lessons in five groups (control, localization, perception, planning, safety) and 9 chapters with derivations.
- Vehicles from unicycle to a dynamic car with tyre slip; actuation imperfections.
- Sensors: odometry, gyro, lidar, beacons, GNSS, sonar ring, radar; weather; a switchboard and a fault schedule.
- Localization: EKF, particle filter, EKF-SLAM, scan matching, pose-graph SLAM.
- Planning and control: A*, RRT*, Hybrid A*, D* Lite, MPC, DWA and more; user code slots with tested examples.
- Three learned models (detector, predictor, policy), retrainable in the page.
- Safety tooling: contact severity, leading indicators, ODD sheet, scenario search over generated worlds.
- Levels as JSON plus a seeded world generator.

Out of scope: runtime dependencies or network access, quoting the safety standards, hosting while the repo is private.

## Next big items
1. Decide whether Safety becomes its own mode — Spy · a decision.
2. Safety lab phase 3: per-slice metrics for the learned blocks, out-of-distribution score, opt-in radar emergency brake; lessons saf/06–07 — Claude · one release.
3. Housekeeping with the next release: close PR #98, fix the stale status line in `docs/safety-lab.md` — Claude · minutes.
4. Safety lab phase 4: rates with intervals, GSN editor, browser storage for sheets and sets; lessons saf/08–09 — Claude · one or two releases.
5. Go public (repo public, Pages on) — Spy · a decision.
