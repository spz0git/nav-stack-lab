# Nav Stack Lab — architecture and roadmap

Artifact: https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7 (browser simulator; v1 2026-10-03, v2 2026-10-04 car-like robot, v3 2026-10-04 MPC, v4–v5 beacon colour, Symbols tab, one-screen layout, v6 2026-10-10 loop analysis + lessons, v7 2026-10-11 agent tracking, prediction and ST speed planning; people in the parking lot; v8–v13 2026-10-11 the enhancement plan: usability, modules + worker core, experiments, code slots, lessons, fidelity)
Source: https://github.com/spz0git/nav-stack-lab (from v13; `./build.sh`, tests in `tests/`)

## Robot and world
- Two kinematic models, selectable in Vehicle:
  - Unicycle (differential drive): exact arc integration, robot radius 0.3 m, can turn in place.
  - Car-like (kinematic bicycle), pose at the rear-axle centre: θ̇ = v tan δ / L. Defaults: L = 0.6 m, δ_max = 32° (R_min 0.96 m), steering rate 1.5 rad/s, body 0.9 × 0.5 m. Physics uses the exact oriented rectangle; planners, DWA and MPC use 3 covering circles (≈0.14 m conservative at the bumpers).
- Actuation: control latency (whole 50 ms ticks, command queue) → saturation → first-order lag τ → acceleration limits → (car) steering-rate limit → actuator bias (car steering misalignment in degrees; diff turn-rate bias in rad/s).
- Sensors: wheel odometry reporting (v, ω) (noise + calibration bias the filters are not told about), 120-beam 360° lidar (8 m, 10 Hz), range/bearing beacons (5 Hz, line-of-sight, optional unlabeled + clutter).
- 24 × 16 m world, 0.1 m grids, 20 Hz fixed step.

## Subsystems implemented
1. Localization: ground truth, dead reckoning, EKF (Joseph form, Mahalanobis gating), particle filter (low-variance resampling, augmented MCL + sensor-resetting injection, lidar likelihood field, motion-gated updates). NEES consistency metric.
2. Perception: prior map or log-odds occupancy mapping in the estimated frame; distance-transform costmap with inflation. Moving agents (v7): ground truth or a lidar tracker (unexplained hits → beam clusters → constant-velocity Kalman filter per agent, χ² gate 9.21, greedy nearest neighbour, confirm after 3 hits, coast 1 s); prediction constant velocity or frozen, radius r + g·t.
3. High-level planning: mission FSM (IDLE/PLAN/DRIVE/NO_PATH/LOST/DONE), replan on blocked / stuck / timer, lost-guard, waypoint ordering (in order, greedy, exact TSP). Multi-leg plans with cusps; posed goals for the car.
4. Motion planning: straight line, A*, RRT*; car only: Reeds–Shepp (endpoint-verified) and Hybrid A* (RS analytic expansion, max(2D Dijkstra, RS) heuristic, planning at 85% of δ_max).
5. Control: pure pursuit, rear-wheel feedback, Stanley (car), PID, DWA, MPC, user JavaScript controller in a Web Worker.

## MPC
- One solver, two formulations: NMPC (relinearize about the latest nonlinear rollout every iteration) and LTV-MPC (linearize once about the reference, predict with the linear model, convex QP).
- Model: x = [x, y, θ, v, s] with s = ω (diff) or δ (car); u = [a, ṡ], so acceleration and steering-rate / angular-acceleration limits are exact box constraints. Optional actuator-lag model adds [v_cmd, s_cmd] (7 states). Steering angle / ω saturates inside the model.
- Command in Δu form (v6): command = own previous command + u̇·T, with bumpless transfer (falls back to the measured state when the MPC did not run on the previous tick, e.g. on PLAN ticks). This gives the MPC integral action on its input, so it rejects a constant diff-drive turn-rate bias. It does not see car steering misalignment (bias added after the steering state).
- Cost: along-track, lateral, heading and speed error against a time-parametrized reference (same speed profile as the other trackers), terminal multiplier, input weights on a and ṡ, Δu weight between moves.
- Horizons: prediction horizon Np and control horizon Nc (move blocking: u_k = u_{Nc−1} for k ≥ Nc; 2·Nc decision variables). Step Δt tunable.
- Constraints: input box (exact, projected-Newton box QP); speed sign/limit per leg, |s| ≤ s_max and lidar obstacle clearance (footprint circles ≥ margin, NMPC only) via augmented Lagrangian with tunable ρ.
- Solver: single-shooting Gauss–Newton SQP with forward sensitivities and finite-difference Jacobians, backtracking line search, warm start shifted by one tick (RTI-style), 15 ms budget. Typical solve ≈ 1 ms, worst observed ≈ 15 ms.
- Results (headless runs): L1 cross-track RMS 0.051 m (rear-wheel feedback 0.083, pure pursuit 0.105, LTV 0.089, Nc = 1 0.178). L5 with τ = 0.15 s: 0.082 m with and without the lag model after the Δu change (the lag model changes the loop margins more than the tracking error). L4: NMPC with obstacle constraints 4/4; LTV clips the table. L6: NMPC parks 4/4 with no collisions; LTV collides in the parallel slot.
- Known limits: obstacle constraints use a lidar snapshot (people treated as static); the reference is per leg, so the MPC does not plan through a cusp. A minimum-progress constraint was tried for L6 and made things worse (circling); reverted.

## Enhancement plan delivered (v8–v13)
- Source layout: `src/` with 48 modules (core without DOM, ui, analysis, worker), `node build.mjs` builds the single page; the headless core also runs in Web Workers. The zip in the chat holds the tree; the review-and-plan doc in this project records the decisions.
- Usability (v8): Try items are buttons on every level; first-run cue; Ready state; Kidnap button; goals/agents vocabulary; map zoom, pan, follow and hover cards; ¼× and ½× speed; pause on contact; shortcuts (Space, N, R, [, ], F, 0, A); taller telemetry with a second channel; changed-parameter marks with per-field reset and tooltips; one scrolling right column.
- Research (v9–v10): Experiments tab (settings grid × seeds in parallel workers, table, bar chart, CSV via the viewer's save dialog); configuration as a link or JSON; ghost of the previous run on the map and in the plots; replay scrub bar while paused.
- Open stack (v11): code slots for the controller, planner, localizer and agent predictor, each with a worked example (A* planner, fixed-gain beacon localizer, decaying constant-velocity predictor); "View the source" in every How-it-works and for the analysis.
- Teaching (v12): 28 lessons in four groups (localization 5, perception 5, planning 5, control loop 13); live FSM diagram in Mission; searchable Symbols; Analysis gains a speed-loop view, curved operating points (gains read about the settled point on a circle) and experiments run through the estimator.
- Fidelity (v13): EKF-SLAM (unknown beacon positions, known or unlabeled IDs); sensor latency for lidar and beacons; reactive pedestrians (social force); another vehicle in the parking lot that yields; space-time A* (x, y, t) for the diff-drive robot.
- Verification: the L1–L5 regression is unchanged through every phase; the worker core reproduces the page's results; every Try button (84 in lessons and levels) runs without error.
- Known limits added by these phases: MPC in the parking lot with people still makes 1–2 contacts (its reference speed does not yield; only the path trackers use the ST speed planner); EKF-SLAM drifts until loop closure by design, so with a 7 m beacon range it misses goals; space-time A* is diff-drive only.

## Moving agents (v7)
- Before v7 people only reached the stack as lidar hits: the global planner never saw them, DWA and MPC treated hits as static at scan time, and pure pursuit ignored them.
- Architecture: global path static on purpose; agents handled at the trajectory level (path–velocity decomposition); escalate to a replan only when speed alone cannot resolve the conflict.
- Path trackers (pure pursuit, rear-wheel feedback, Stanley, PID): Moving agents = Ignore / Reactive stop (brake for unexplained hits in the footprint corridor) / Speed planning. The ST planner runs DP over (t, s, v) with Δt 0.2 s and horizon T_p. Costs: speed error to v_ref(s), acceleration, proximity, a hard cost when the predicted bodies overlap (soft cost in the uncertainty band), and a terminal cost so the profile cannot end parked in an agent's lane just past the horizon. The speed at 0.2 s caps the tracker and curvature is kept.
- Escalation: unavoidable conflict for about 0.3 s, or about 4 s of waiting, triggers a replan. That plan alone has agents' predicted positions over the next 2 s in the costmap.
- DWA checks each rollout against the agents' predicted positions at the same time step. NMPC gets one clearance constraint per footprint circle and step against the nearest predicted agent. Hits from tracked agents are removed from the static point set.
- UI: ST graph telemetry tab (occupancy, chosen profile, the profile without agents, MPC/DWA prediction projected on the path). Map layer with tracks, predicted rings at 1 s intervals, and ego predicted positions with matching time numbers. New metrics: contacts into the stopped robot, closest approach, track counts. Symbols group, notes, and obs.agents for custom code.
- L6 now has 4 pedestrians crossing the lanes, pausing 1–3 s at the ends of their walks (this breaks constant-velocity prediction when they stop and when they set off again).
- Results (people contacts per mission):
  - L5 seed 7: Ignore 3, Reactive 3, ST with lidar tracking 1, ST with ground truth 0.
  - L5 seeds 2–5: ST with lidar ≈1 per run versus 3 when ignoring. The residual case is a person reversing at the end of their walk beside the robot.
  - L6: Ignore 5, Reactive 1 (walked into the stopped car), Frozen prediction 1, ST lidar 0 on seeds 1–4.
  - L5 MPC with predictions 0 versus 3 without.
- Tracker accuracy in L5: position error ≈0.11 m, velocity error ≈0.15 m/s. Phantom tracks appear at shelf faces when particle-filter error is large (seed-dependent).
- Limits: people do not react to the robot (no interaction model); single-hypothesis constant-velocity prediction; the global planner never reasons in time (no space-time search).

## Loop analysis (v6)
- Simulation/Analysis switch above the map. Analysis covers the lateral tracking loop for pure pursuit, rear-wheel feedback, Stanley, PID and MPC (DWA and user code are not linearizable here).
- Linearization: straight path at v₀ = min(cruise, v_max). Plant θ̇ₑ = g·u (g = 1 diff, v₀/L car), ė = v₀·θₑ. Controller gains are read from the actual controller code by central finite differences on a sandboxed copy of the simulator state (MPC also gives gains on the steering state, the lagged command and its own previous rate).
- L(jω): continuous vehicle behind a zero-order hold (e^{−sT/2}) plus latency; discrete elements (actuator lag, PID integral/derivative, MPC rate integrator and memory) are evaluated exactly at z = e^{sT}.
- Exact 20 Hz linear closed loop gives the step and bias responses and the closed-loop poles (s = ln z / T); root locus scales the controller ×0.06–×16.
- Outputs: block diagram; chips for stability, PM, GM (negative when unstable), ω_c, delay margin PM/ω_c, M_s, dominant ζ/ω_n, overshoot, settling, steady error under actuator bias; Bode (optional |S|, |T|), Nyquist (compressed radius log₂(1+|L|) or linear, closest approach 1/M_s, encirclement count Z = N + P), time response, pole/zero + locus.
- Experiments in the real nonlinear simulator: step test (overshoot, settling, time on the steering-rate limit) and sine injection at the plant input (L = −U_c/U_p by lock-in, small or large amplitude) to compare against the model.
- Verification: injection matches the model within 0.1 dB / 1° for PP, RWF, PID, MPC (with/without lag and lag model, car, latency); predicted and simulated step metrics agree; Nyquist count and eigenvalues agree in every lesson configuration.
- Learn tab: 10 lessons with Try buttons — the loop, pure pursuit as PD, Bode, Nyquist, delay margin and limit cycles, poles and damping (RWF ζ = k_θ/(2√k_e)), actuator lag and what MPC assumes, integral action, linear vs nonlinear, gain scheduling with speed.

## Levels
- L1 Open floor — isolate the controller.
- L2 Warehouse aisles — global planning.
- L3 Noisy odometry — localization, filter consistency, kidnapping.
- L4 Unknown building — mapping + replanning.
- L5 Busy floor — moving people, accel limits, lag, unlabeled beacons, global localization.
- L6 Parking lot — car-like robot: reverse-in bay, nose-in bay, 2.2 m parallel slot.

## Candidate next steps
- Agents: interaction-aware prediction (the predictor does not know people react); multi-modal prediction; JPDA/multi-hypothesis tracking; an ST speed planner for MPC's reference.
- Localization: timestamped (lagged-state) filtering to absorb sensor latency; scan matching for SLAM without beacons.
- Planning: space-time planning for the car (Hybrid A* in time).
- Analysis: longitudinal (speed) loop; analysis on a curved path (operating point at constant curvature); localization in the loop (EKF as a dynamic element, so estimator bandwidth shows up in the margins); disturbance/noise spectra.
- MPC across cusps (reference spanning the next leg, per-step speed-sign constraints) so it pre-steers for the next gear.
- Velocity obstacles / ORCA as an alternative local planner.
- L9 SLAM: EKF-SLAM with unknown beacon positions, or scan matching + pose graph.
- L10 Exploration: frontier-based exploration with unknown-as-lethal.
- Custom-code slots for planner and localizer.
- Optional: matching Python package for offline experiments.
