# Good first issues

Drafts for the issue tracker, labelled `good first issue`. Each is self-contained, touches one or two files, and has
a test or a measurement that says when it is done. The gate every PR passes is in [CONTRIBUTING.md](../CONTRIBUTING.md).

## 1. A lesson on the gate: what Mahalanobis gating does to a wrong beacon (content)

**Where:** `src/analysis/lessons2.js`, localization group; chapter 2 §6 already derives the gate.
**What:** a lesson with two Trys on L3: beacons with clutter (`clutter` setting) with the gate on, then the gate
opened wide (the `gate` setting), and the NEES and pose RMS of both measured with `tests/measure_loc.py` and quoted in
"What you will see". Link the formula to `#notes=ch2/data-association-and-the-gate`.
**Done when:** `tests/tles.py` lists the lesson, `tests/p5test.py` runs both Trys without error, the numbers in the
text are the measured ones (seed 7).

## 2. A signal: the planner's expansions per plan (signal)

**Where:** `src/ui/signals.js` (the registry) and `src/core/record.js` (`sig` in a frame).
**What:** the number of expansions of the last plan, already in the event log text ("A* 9.9 m · 969 expansions"),
as a signal in the planning group so it can be plotted against time and compared between runs.
**Done when:** the signal appears in the signal browser and in Values, plots on L2, and `tests/test.py`'s summary is
unchanged (recording a number changes nothing in the simulation).

## 3. Octile versus Euclidean heuristic in A* (planner heuristic)

**Where:** `src/core/planning.js` (`astar`), a `heur` setting in `src/core/params.js` and `src/ui/schema.js`.
**What:** an option for the A* heuristic (octile, the default, versus Euclidean) with a Try button in L2's list that
shows the expansion count of each on the same plan. Chapter 4 §2 explains admissibility; add a sentence on why octile
expands fewer nodes.
**Done when:** both options plan the same length on L2, the expansion counts are printed in the Try's text, the
L1–L5 summary is unchanged with the default.

## 4. A chapter note: the social-force pedestrian model (chapter)

**Where:** `docs/notes/ch3-perception.md`, a new section; the model is in `src/core/fidelity.js`.
**What:** the equations the reactive pedestrians follow (goal force, repulsion from the robot and from each other,
the parameters the lab uses), with one `{{live:…}}` value and one `[try: …]` button on L5 with people set to
reactive.
**Done when:** `tests/chtest.py` fills the live value and runs the Try; the section reads like the others.

## 5. The event log's severity filter (workspace)

**Where:** `src/ui/log.js`.
**What:** three toggle chips above the log, All · Warnings · Errors, that filter the lines by their class (`warn`,
`bad`), remembered in `localStorage` with the other layout settings. Foxglove's Log panel is the model.
**Done when:** the chips filter live and in replay, keyboard operable, `tests/p1test.py` passes.

## 6. Gyro bias as a Vehicle setting for the car with tyre slip (sensor)

**Where:** `src/core/sensors.js`, `src/core/params.js`, the Vehicle tab in `src/ui/schema.js`.
**What:** the dynamic car's yaw-rate reading gets a constant bias (deg/s) the filters are not told about, like the
odometry calibration bias. One Try in the lessons' control group showing the drift it causes in dead reckoning.
**Done when:** the bias shows in the Changed list, the Try's numbers are measured with `tests/measure_dyn.py`,
`tests/dyntest.py` passes.

## 7. "Whole run" button also fits the x-axis of the Analyze step plot (analysis UI)

**Where:** `src/analysis/ui.js`.
**What:** the step-response figure keeps a fixed window; after a long settling time the tail is cut. Add the same
"Whole run" control the plot dock has so the figure shows the full measured response.
**Done when:** a step test with the slow loop (lookahead 1.5 m) shows its full 4 s settling, dark mode included.

## 8. Phone: the level selector's height (phone layout)

**Where:** `src/styles.css`, the `@media (max-width:760px)` block for `.levels`.
**What:** on a 375 px wide screen the L1–L6 selector stretches to about 380 px tall between the telemetry dock and
the level brief. Make it a single compact row (two rows of three at most).
**Done when:** `tests/shots.py phone-first` shows the selector under 60 px tall and `tests/p1test.py`'s phone
checks pass.

## 9. A notation page in the Symbols tab (content)

**Where:** `src/ui/nomenclature.js`.
**What:** one short section at the top that states the conventions the lab uses everywhere: e > 0 to the left of
the path, θ_e = heading − path tangent, Q the measurement noise, M the odometry noise, R the process noise in state
space, b the bearing. Link each to the chapter section that introduces it.
**Done when:** the section renders, the palette finds its terms, `tests/tles.py`'s glossary check passes.
