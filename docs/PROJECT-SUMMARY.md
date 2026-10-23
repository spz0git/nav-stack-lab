---
format: 2
project: nav-stack-lab
title: Nav Stack Lab
kind: code
source: https://github.com/spz0git/nav-stack-lab
commit: 7c5ea32
updated: 2026-10-23
status: active
stage: v63 released 2026-10-23 (a Sensors tab, numbered pipeline tabs, scoped tests); safety lab phases 1 and 2 built (5 of 9 safety lessons, Tools → Safety)
next_action: Spy decides whether Safety stays a Learn group plus Tools tab or becomes its own mode, then Claude builds safety lab phase 3
blocked_on: nothing
confidential: false
---

# Nav Stack Lab

## What it is
A robot navigation simulator and course that runs in the browser as one offline HTML file. It is for students and engineers learning how localization, perception, planning, control and safety standards fit together. The repo is private. The live page is a claude.ai artifact (https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7). A GitHub Pages demo is built but stays off until the repo goes public.

## Status
- Released at v63 (2026-10-23): a Sensors tab with every sensor's switch, noise and specs, noise profiles, lidar reach and dropouts (v62), and numbered pipeline tabs.
- v60 and v61 (2026-10-22) were safety lab phases 1 and 2.
- Testing is scoped since 2026-10-23: a PR runs a 40 s smoke test plus the tests of the areas it touches; the full 12-minute suite runs nightly.
- Health: all tests passed for v63 before its merge; no open PRs (#98 closed as superseded).
- Waiting on Spy: whether Safety becomes its own mode (decision 4, due now that phase 2 is done); confirming 33 unchecked clause numbers (no longer blocking); whether to go public or stay private.

## Features and scope
- Three modes: Simulate, Analyze (Bode, Nyquist, poles, LQR) and Learn.
- 50 lessons in five groups (control, localization, perception, planning, safety) and 9 chapters with derivations.
- Vehicles from a unicycle to a dynamic car with tyre slip, plus actuation imperfections.
- Sensors in their own tab: odometry, gyro, lidar, beacons, GNSS, sonar ring and radar, with noise profiles, weather, a switchboard and a fault schedule.
- Localization: EKF, particle filter, EKF-SLAM, scan matching and pose-graph SLAM.
- Planning and control: A*, RRT*, Hybrid A*, D* Lite, MPC, DWA and more, with user code slots and tested examples.
- Three learned models (detector, predictor, policy) that can be retrained in the page.
- Safety tools: contact severity, leading indicators, an ODD sheet and scenario search over generated worlds.
- Levels stored as JSON, plus a seeded world generator.

Out of scope: runtime dependencies or network access, quoting the safety standards, and public hosting while the repo is private.

## Next big items
1. Decide whether Safety becomes its own mode — Spy · a decision.
2. Safety lab phase 3: per-slice metrics for the learned blocks, an out-of-distribution score, an opt-in radar emergency brake, and lessons saf/06–07 — Claude · one release.
3. Housekeeping with the next release: fix the stale status line in `docs/safety-lab.md` (it still says "design only, nothing built") — Claude · minutes.
4. Safety lab phase 4: rates with intervals, a GSN editor, browser storage for sheets and sets, and lessons saf/08–09 — Claude · one or two releases.
5. Go public (make the repo public and turn Pages on) — Spy · a decision.
