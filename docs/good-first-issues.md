# Good first issues

Drafts for the issue tracker, labelled `good first issue`. Each is self-contained, touches one or two files, and has
a test or a measurement that says when it is done. The gate every PR passes is in [CONTRIBUTING.md](../CONTRIBUTING.md).

## 1. A lesson on the gate: what Mahalanobis gating does to a wrong beacon (content)

**Where:** a new file `docs/lessons/loc/10-….md` (the format is in the header of `tools/lessons.mjs`); chapter 2 §6
already derives the gate. The gate is fixed today (χ² 9.21, two degrees of freedom, on only with unknown association,
in `ekfUpdate`, `src/core/localization.js`), so the issue includes a `gate` setting in `src/core/params.js` and
`src/ui/schema.js`, with today's value as the default.
**What:** a lesson with two Trys on L3: beacons with clutter (`clutter` setting) and unknown association with the
gate as it is, then the gate opened wide, and the NEES and pose RMS of both measured with `tests/measure_loc.py` and
quoted in "What you will see". Link the formula to `#notes=ch2/6-data-association-and-the-gate`.
**Done when:** `tests/tles.py` lists the lesson with no errors, `tests/p5test.py` runs both Trys without error, the
numbers in the text are the measured ones (seed 7), and `tests/test.py`'s L1–L5 summary is unchanged with the default
gate.

## 2. A signal: the planner's expansions per plan (signal)

**Where:** `src/ui/signals.js` (the registry) and `src/core/record.js` (`sig` in a frame).
**What:** the number of expansions of the last plan, already in the event log text ("A* 9.9 m · 969 expansions"),
as a signal in the planning group so it can be plotted against time and compared between runs.
**Done when:** the signal appears in the signal browser and in Values, plots on L2, and `tests/test.py`'s summary is
unchanged (recording a number changes nothing in the simulation).

## 3. Octile versus Euclidean heuristic in A* (planner heuristic)

**Where:** `src/core/planning.js` (the heuristic `h` in `gridSearch`, which `astar` calls), a `heur` setting in `src/core/params.js` and `src/ui/schema.js`.
**What:** an option for the A* heuristic (octile, the default, versus Euclidean) with a Try button in L2's list that
shows the expansion count of each on the same plan. Chapter 4 §2 explains admissibility; add a sentence on why octile
expands fewer nodes.
**Done when:** both options plan the same length on L2, the expansion counts are printed in the Try's text, the
L1–L5 summary is unchanged with the default.
