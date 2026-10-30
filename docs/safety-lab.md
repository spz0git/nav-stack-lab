# Safety lab: design

Status: built, all four phases and nine lessons (v60–v66, 2026-10-22 to 2026-10-24): phases 1 and 2 (v60, v61), phase 3
(v64), phase 4a (v65: rates, importance sampling, leading indicators, lesson 8) and 4b (v66: the ODD monitor, the
argument, storage, lesson 9). Decision 4 was looked at again with the argument graph: it fits the Tools tab with a
full-width view, so Safety stays a Learn group and a Tools tab. The clause numbers of section 10 still wait for a check (since 2026-10-30 only this document cites them; see the note under "Rules for writing it"). Written against v59 as a
proposal for a new track inside Nav Stack Lab that teaches the ideas of four safety standards by doing them on the
simulator; what was built is in the roadmap's "Safety lab" sections. The owner's decisions on the design
questions are recorded in section 9; the clause numbers the track cites wait for the owner's check in section 10.

- [1. What the track is for](#1-what-the-track-is-for)
- [2. The standards, and how they map onto this lab](#2-the-standards-and-how-they-map-onto-this-lab)
- [3. Concepts and exercises](#3-concepts-and-exercises)
- [4. How it fits the page](#4-how-it-fits-the-page)
- [5. What the lab already has, and what is missing](#5-what-the-lab-already-has-and-what-is-missing)
- [6. Core changes and their effect on the baseline, the lesson numbers and the page size](#6-core-changes-and-their-effect)
- [7. Overlap with the roadmap](#7-overlap-with-the-roadmap)
- [8. Phased plan and draft lesson list](#8-phased-plan-and-draft-lesson-list)
- [9. Decisions](#9-decisions)
- [10. Clause numbers to confirm](#10-clause-numbers-to-confirm)

## 1. What the track is for

The existing tracks teach how each block of a navigation stack works and how it fails. The safety track asks the next
question: given a stack that works most of the time, how do you decide where it may be used, find the situations in
which it is unsafe, show what you did about them, and say how much risk is left? Those are the questions the automotive
safety standards organise, and every one of them can be practised here, because the lab already has the ingredients:
levels and a world generator to define where the robot operates, seven sensors with modelled failures and a switchboard
to turn them off, faults the filters are not told about, people who do or do not react, learned blocks with known
training data, health lights, a headless core that runs a mission in a couple of seconds, and the Experiments tab.

The learner should leave able to:

1. write an operating domain (ODD) for this stack and say whether a given level is inside it;
2. carry out a small hazard analysis and risk assessment and turn it into safety goals with measurable limits;
3. tell a fault (something broke) from a functional insufficiency (nothing broke, the design was not good enough for
   this situation) and name the triggering condition that exposed it;
4. run a scenario search with the headless core, find a failure nobody wrote down, and turn it into a regression case;
5. build a safety argument in GSN whose evidence is runs the page can repeat, and watch it break when the evidence does;
6. estimate a residual-risk rate with a confidence bound, and say how many simulated hours a target would need.

What the track is not: a certification course, a replacement for the standards' text, or a claim that this robot meets
any of them. The lab's robots are a warehouse robot and small cars at walking to running speed; the four standards are
written for road vehicles. The track uses them as a vocabulary and a method, and says so in its first lesson. It
teaches these four standards and no others (decision 1).

### Rules for writing it

- **Paraphrase, never quote.** The standards are copyrighted. Lessons, chapters, glossary entries and this document
  describe what a clause is about in their own words and cite the clause number. No sentence, table or figure from a
  standard is reproduced, including the ASIL determination table (section 3.2 explains the rule another way).
- **Cite the edition and clause.** ISO 26262:2018 (parts 1–12), ISO 21448:2022, ISO/PAS 8800:2024 and ANSI/UL 4600
  third edition (2023). A citation reads "ISO 21448, clause 7" or "ISO 26262-3, 6.4.3". The clause numbers in this
  document were checked against public tables of contents and secondary descriptions, not against licensed copies.
  The lessons were released with them unconfirmed and say so: each carries a sentence that the clause numbers come
  from public outlines and have not been checked against the texts. The owner's check against the licensed texts
  (section 10) is pending. A confirmed number loses the caveat in the lessons that cite it (so far one: ISO 26262-2
  6.4.8, confirmed from the 2018 edition's contents page, in saf/09); a corrected one is changed in the lessons, the
  chapter and this document together.
- **Note, 2026-10-30: the lessons and chapter 8 no longer cite clauses.** The rule above is the earlier policy; the owner found bare clause numbers confusing for a reader who cannot open the texts. Each lesson now says in its own words what its standard asks for and why, and chapter 8 §1 introduces the four standards once, with a link to each publisher's page and the statement that the lab paraphrases them. Clause numbers stay in this document only, for checking the design against the texts.
- **Measured, not asserted.** As everywhere in the lab, every number in a lesson's "What you will see" is measured
  headless first, and a Predict's answer holds at other seeds and can be checked by looking at the page.
- **The lab's own scales are labelled as such.** Where the track needs a scale the standards define for cars (severity,
  for example), it defines its own for the robot and says that it is the lab's, not the standard's.

## 2. The standards, and how they map onto this lab

| Standard | What it is about, in one line | Where it shows in the lab |
| --- | --- | --- |
| ISO 26262:2018, functional safety | Risk from **malfunctions** of electrical and electronic systems: something fails, and the design must detect it and reach a safe state in time. | Faults: a sensor switched off (the Sensors switchboard), odometry and gyro bias the filters are not told about, beacon outages, GNSS outages, a kidnap, actuator lag and steering misalignment. |
| ISO 21448:2022, safety of the intended functionality (SOTIF) | Risk with **nothing broken**: the specified function, or its sensors and algorithms, is not good enough for some situations (functional insufficiencies) and some conditions (triggering conditions) expose that. | Fog shortening the lidar, a sonar missing a slanted wall, GNSS multipath near racks, a particle filter fooled by symmetric beacons, constant-velocity prediction of a person who turns back, velocity-obstacle cones that know no walls, low grip at speed. |
| ISO/PAS 8800:2024, safety and AI | The SOTIF and functional-safety questions for **learned components**: data requirements and coverage, distribution shift, verification of a model, monitoring in operation. | The learned people detector, the learned predictor and the end-to-end policy, with their training runs listed in the model files; the Train tab to retrain them. |
| ANSI/UL 4600 ed. 3, safety of autonomous products | A **safety case** for a product with no human driver: claims, arguments and evidence covering the ODD, hazards, every autonomy function, testing, and **safety performance indicators** that check the case keeps holding in operation. | The whole stack in a level; the argument graph (new); SPIs from run metrics such as close approaches and safety-stop interventions. |

The GSN notation follows the GSN Community Standard, version 3 (SCSC-141C, 2021); it is a notation, not a safety
standard, and the track uses it only to draw the argument.

The 26262 / SOTIF split is the track's backbone, and the lab draws it cleanly: the switchboard and the fault parameters
make malfunctions; weather, geometry and people's behaviour make insufficiencies with every part working. Lesson 3 and
lesson 4 are the same mission, once with a triggering condition and once with a fault, so the difference is something
the learner has seen rather than been told.

**The item.** ISO 26262-3 clause 5 starts from an item definition: what the system is, its functions, its boundary and
its interfaces. In the lab the item is "the navigation stack as configured, driving a mission in a level": the
configuration is the level's settings plus anything the learner changed, which the page can already export (levels are
data, `src/core/levels.js`). The first exercise of every lesson names its item this way.

## 3. Concepts and exercises

Each subsection gives what the standards say (paraphrased, with clauses), the hands-on exercise, what exists for it
today and what is missing. Section 5 collects the inventory; section 6 the core changes.

### 3.1 The operating domain (ODD)

**What the standards say.** ISO 21448 clause 5 asks for a specification of the intended functionality that includes
the conditions it is meant to work in; clause 13 asks that the operating domain be watched in use. UL 4600 clause 8
asks the safety case to define the ODD and to argue that the system behaves acceptably inside it and recognises when
it is outside it. ISO/PAS 8800 clause 9 derives the AI component's requirements from that domain, and clause 11 asks
that the training and test data cover it. The lab's ODD sheet groups its attributes as the layout, the environment
(weather, beacons, GNSS, grip) and the moving things (people and their speeds), with the robot's own limits beside them.

**The exercise.** The learner writes an ODD for the stack on the busy floor as a sheet of ranges, then tests it:

1. Fill an ODD sheet for L5's configuration: layout family (warehouse), aisle width, number of people and their speeds,
   whether they react, weather, beacon density, GNSS availability, floor grip, the robot's speed.
2. Sample generated worlds inside the sheet (the generator's parameters are ODD dimensions already: `aisle`, `depth`,
   `gaps`, `people`, `beacons`, `w`, `h`) and run them headless: the contact and close-approach rates stay low.
3. Sample just outside one boundary at a time (aisles of 1.2 m, fog, people at 1.4 m/s, half the beacons) and watch
   which boundary the rates are sensitive to. The learner moves the sheet's limits to where the measured risk changes,
   which is what an ODD is for: a statement of where the evidence holds.
4. Ask whether the robot could tell it had left the ODD. Some boundaries are observable from the robot (the lidar's
   return ratio drops in fog; tracked people move faster than the sheet allows; GNSS reports a large σ), some are not
   (floor grip before the tyres slip). The unobservable ones need an operational restriction instead of a monitor.

**Exists.** The generator and its families (`src/core/worldgen.js`), weather (`P.weather`), people modes, the beacon
and GNSS settings, the level menu that saves and shares a level, the Experiments tab.

**Missing.** An ODD sheet as data (JSON: ranges and allowed values per attribute) with a check of a level or generator
spec against it, attribute by attribute (inside, outside, or "not derivable" for built-ins and custom levels whose
aisle width is not a parameter); a runner that samples generator specs from a sheet (the Experiments tab varies
settings, not the world); and, for step 4, an optional runtime ODD monitor (section 6, C6).

### 3.2 Hazard analysis and risk assessment (HARA)

**What the standards say.** ISO 26262-3 clause 6 analyses operational situations, identifies hazardous events, and
classifies each by severity, exposure and controllability (6.4.3); the three classes give an integrity level (ASIL,
6.4.4) and each hazardous event of note gets a safety goal (6.4.5). ISO 21448 clause 6 identifies hazards from the
intended functionality the same way (6.3), evaluates their risk (6.4) and sets acceptance criteria for the residual
risk (6.5). UL 4600 clause 6 asks for hazard identification that is not limited to a fixed checklist and for a risk
evaluation of each hazard, kept in a hazard log that the safety case refers to.

**The exercise.** The learner builds a hazard log for the busy floor and the parking lot, with numbers the simulator
measures:

1. **Operational situations.** Crossing an aisle while a person walks it (L5), passing through a doorway (L4), reversing
   out of a bay with people in the lane (L6), the avoidance manoeuvre at 3.5 m/s (L7), parked while a person walks by.
2. **Hazardous events.** The robot strikes a person; the robot strikes a rack or wall; the robot stops in a doorway or
   lane and is struck (in this lab, "a person walked into the stopped robot", which the core already counts).
3. **Severity.** Cars use injury scales; the lab defines its own from the relative speed at contact (under 0.3 m/s,
   0.3–1 m/s, over 1 m/s; decision 3), labelled as the lab's scale. The core counts contacts but does not record the
   speed of each one: that is change C1.
4. **Exposure.** The fraction of operating time spent in each situation, measured over runs (time with a person within
   2 m, time in a doorway, time reversing). Measured exposure is a teaching point the standard's tables do not offer:
   the learner sees that exposure is a property of the ODD and the mission, and changes when either does.
5. **Controllability.** With no driver, controllability is about the other people involved: ISO 26262 counts
   everyone exposed, not only a driver. The lab has exactly that switch: scripted people never step aside, reactive
   people (`people: 'reactive'`) do. The difference in contacts between the two, on the same seeds, is the measured
   share of hazardous situations other people resolve. Most driverless analyses take no credit for it; the exercise
   shows what taking it would assume. The robot's own reaction is not controllability (the analysis rates it going
   wrong, so crediting it would count the same protection twice); the lab names it separately as the avoidance
   margin, time to contact minus the time to stop, read from Metrics → Time to contact, as evidence for the safety
   goal rather than an input to the rating.
6. **Integrity level and safety goal.** The ASIL rule is explained without reproducing the table: with the classes
   numbered, the level rises one step for each step up in any class, from QM at the bottom to D for the worst case in
   all three. Each hazardous event gets a safety goal in measurable terms ("no contact with a person above 0.3 m/s
   relative speed in the ODD of 3.1"), which the later lessons verify and argue.

**Exists.** Contact counts (`S.coll`, `S.collPed`, `S.collPedStill`), the closest approach (`S.minPed`), the levels,
reactive people, the Experiments tab for seeds.

**Missing.** Impact speed and a per-event record (C1); time-in-situation counters for exposure (C3); a hazard log as
data, editable in the page and exportable, which the argument graph (3.5) can cite.

### 3.3 Triggering conditions, functional insufficiencies, and faults

**What the standards say.** ISO 21448 clause 7 looks for the functional insufficiencies of the specification and of
the sensing, perception, planning and actuation, and for the triggering conditions that can expose them, then judges
whether the system's response to each is acceptable; clause 8 modifies the function to remove or restrict what is not
(better sensing, a restricted ODD, handing over, a minimal-risk manoeuvre). ISO/PAS 8800 clause 13 extends the
analysis to the causes of errors in a learned component. On the fault side, ISO 26262-4 clause 6 (technical safety
concept) asks for safety mechanisms that detect a fault and bring the system to a safe state, within the fault
tolerant time interval defined in ISO 26262-1 clause 3; ISO 26262-9 clause 8 covers the inductive and deductive safety analyses
(FMEA, FTA) used to find those faults.

**The exercises.** Two lessons on the same mission.

*Faults (26262).* On L5 the learner switches a sensor off in mid-mission and measures three times: when the fault
happens, when the stack notices (a health light turns amber or red, the log says what was lost), and when the first
hazardous event or close approach follows. The fault tolerant time interval is the gap between the fault and the
hazard; detection plus reaction must fit inside it. Lidar off with the lidar safety stop on: the stop has no input,
the Control light says so, and the time to the first contact is the budget. Beacons off: the EKF coasts on odometry,
the Localize light warns after 3 s of beacon silence, and the lost-guard holds the robot once the position σ passes
1 m; whether that is before the true error reaches the aisle's clearance depends on the odometry bias the filter is
not told about. The learner also builds a small FMEA from the switchboard: one row
per sensor, the effect on each block (the registry already lists it, `SENSORS` in `src/core/sensors.js`), the detection
(the health light), the reaction.

*Triggering conditions (SOTIF).* Nothing is switched off. The learner works through a matrix of conditions the lab
already models, runs each with and without the condition on the same seeds, and attributes the outcome to the block
whose insufficiency it exposed:

| Triggering condition | Insufficiency it exposes | Lesson it already appears in |
| --- | --- | --- |
| Fog (`weather: 'fog'`) | Lidar reach 4 m against the stopping distance; tracks of nobody from backscatter | per/10 Radar |
| A wall met at a slant | The sonar's specular miss | per/09 Sonar |
| A person inside 0.2 m | The sonar's dead zone; the sonar safety stop loses them | per/09 Sonar |
| Large racks near the robot | GNSS multipath: a 2–4 m jump the reported σ does not cover | loc/09 GNSS |
| Unlabeled beacons in a repeating warehouse | The particle filter sits confidently on a wrong pose, or never finds the true one (L5 at seed 1) | loc/04 Particles |
| A person turning back at the end of their walk | Constant-velocity prediction; the residual contact of the speed planner | per/08 Learned predictor; roadmap, Moving agents |
| A shelf beside the escape direction | Velocity-obstacle cones know no walls | per/06 Velocity obstacles |
| Low grip at speed | A controller or speed profile that ignores μg | ctl/15, ctl/17 |
| Sensor latency | Stale tracks, a late stop | per/04 Sensor latency |
| An unknown region treated as free | A plan through a wall not yet seen | per/02 Costmap, plan/06 Frontier exploration |

The lesson's synthesis is SOTIF's four areas (ISO 21448 clause 4): the matrix is the known-unsafe area; the mitigations
of lesson 7 move rows to known-safe; the search of lesson 6 looks for the unknown-unsafe.

The last step of both exercises asks whether the stack can **detect** the condition. For faults, mostly yes: the health
lights were built for that. For triggering conditions, mostly no: no light turns amber in fog, and the GNSS σ does not
grow under multipath. That gap is the motivation for the ODD monitor (C6).

**Exists.** Every row of the matrix; the switchboard and its degradation reports (`healthSensorChecks`,
`src/ui/health.js`); the health lights and their timeline marks; the lidar safety stop (`P.guard`); the lost-guard.

**Missing.** Faults that start and stop at a time, in the headless core: today every fault is a setting for the whole
run, and the two timed events (kidnap and scatter, `act` in a Try) live in the page only (`src/ui/panes.js`), so a
script cannot inject them (C4). A per-event record with the conditions active at the time (C1). The time from fault to
detection, which needs the health lights' state in the headless summary (C5).

### 3.4 Scenario search with the headless core

**What the standards say.** ISO 21448 clause 9 defines a verification and validation strategy with validation targets;
clause 10 evaluates the known scenarios (do the known triggering conditions now behave acceptably?) and clause 11
explores for unknown ones; clause 12 judges, from both, whether the residual risk is acceptable. UL 4600 clause 12
requires the testing to be argued as adequate for the ODD, not merely extensive.

**The exercise.** The learner searches for situations in which the stack on L5's settings fails, inside the ODD of 3.1:

1. **The space.** A generator family and ranges for its parameters, the people's number, speed and phase, weather, the
   seed, and optionally a fault from 3.3 at a time. Every point is a level spec plus overrides, which the worker already
   accepts (`{cmd: 'run', level, seed, overrides}`, `src/worker/main.js`).
2. **The objective.** A continuous robustness measure rather than a pass/fail flag, so the search can climb: the
   smallest body gap to a person (`minPed`, already in the summary; negative is overlap), the smallest gap to a static
   obstacle (missing, C2), the smallest time to collision (missing, C3), weighted by the lab's severity scale.
3. **Random sampling first.** A few hundred runs. The learner sees how rare failures are inside the ODD, and that most
   of the budget is spent confirming the easy cases.
4. **Then a falsifier.** Keep the worst decile, perturb them, repeat (a cross-entropy-style refinement; simple enough to
   read in the Code panel). The same budget finds more and worse failures. The learner opens each found scenario in the
   page with one click (the level spec, seed and overrides make a link, as custom levels already do) and watches it.
5. **Classify.** Each failure is attributed to a row of the 3.3 matrix (known unsafe) or is new (it was unknown
   unsafe). New ones become rows.
6. **Regression.** The found scenarios are saved as a set and rerun after a change: this is ISO 21448 clause 10's known
   scenarios, and the learner sees that a mitigation (lesson 7) must be checked against the whole set, not the one
   scenario that motivated it.

A scripted variant for maintainers (`tools/search.mjs`, over `tests/node/core.mjs`) runs the same search in Node,
which is how the lesson's numbers are measured.

**Budget.** A 400 s mission on a 24 × 16 m world takes about 2 s headless in Node (roadmap, Levels as data and generated worlds); L5's
mission is about 110 s, so a run is well under a second, and 300 samples on the page's four workers take a minute or
two. The search must avoid the MPC's wall-clock budget or set `mpcBudget: 0`, the one machine-dependent input.

**Exists.** The worker protocol with level specs, generator specs, overrides and models; `collectRun`; the Node
harness; the Experiments tab (two parameters × a seed range, four workers, CSV, the paths on the map); links for levels.

**Missing.** A search mode (sample N points from ranges over world and settings, a robustness objective, the
refinement loop, a table of the worst cases with an Open button); the robustness metrics (C2, C3); scenario elements
the generator cannot make yet, above all a person who steps out from behind a rack when the robot comes near (C7),
which is the textbook occluded-pedestrian scenario and the lab's people cannot do (they walk fixed segments from t = 0).

### 3.5 The safety argument (GSN)

**What the standards say.** ISO 26262-2 (6.4.8 in the 2018 edition) asks for a safety case: an argument, supported by
the work products, that the safety requirements are complete and met. UL 4600 clause 5 makes the safety case the centre
of the standard: claims, the arguments that connect them, and evidence for each, with the case kept current as the
product and the evidence change. ISO/PAS 8800 clause 8 asks for an assurance argument for the AI component. GSN is the
common notation: goals (claims), strategies (how a goal is broken down), solutions (evidence), context, assumptions and
justifications.

**The exercise.** The learner builds the argument "The robot on the busy floor is acceptably safe within ODD-1" and
backs every leaf with evidence the page can rerun:

- G1 the top claim, in the context of the ODD sheet (3.1) and the hazard log (3.2);
- S1 argue over each hazard in the log; G2 "no person contact above 0.3 m/s", G3 "no rack contact", …;
- under G2, S2 argue over known and unknown scenarios: G2.1 the known-unsafe set now passes (solution: the regression
  set of 3.4, rerun), G2.2 the search found nothing new in N samples (solution: a search run), G2.3 the residual rate
  meets its target (solution: 3.6's estimate);
- assumptions made visible: "people walk at most 0.9 m/s" (an ODD limit), "the beacons are where the map says".

Evidence is live. Each solution node stores what to run and what must hold (`{run: <search set or Try cfg>, expect:
{metric, op, value}}`), and the page reruns it in the workers and colours the node. The lesson's turning point is a Try
that changes one setting (the lidar safety stop off, or fog on) and reruns the argument: two leaves go red, and the
learner follows the red up to the top claim. That is UL 4600's point that a safety case is something you maintain, not
a document you finish. A second Try asks the learner to add a defeater: a reason the claim might be false that the
current evidence does not address (the person who steps out from behind a rack, before C7 exists).

**Exists.** Nothing for the graph. Everything the evidence needs to run exists or is listed above.

**Missing.** An argument format (JSON: nodes with GSN types, edges, evidence specs), an SVG renderer with the GSN
shapes, a small editor (add, link, edit text, attach evidence), storage in IndexedDB beside custom levels with JSON
export, and an evidence runner shared with the search.

### 3.6 Residual-risk metrics and safety performance indicators

**What the standards say.** ISO 21448 6.5 sets acceptance criteria for residual risk, clause 9 turns them into
validation targets (its informative annex on verification and validation shows how a target becomes an amount of
testing), and clause 12 decides whether they have been met. UL 4600 clause 16 requires safety performance indicators:
metrics that show whether the safety case's claims and assumptions hold in operation, including leading indicators
that move before harm happens; clause 13 of ISO 21448 and clause 14 of ISO/PAS 8800 cover watching the system in use.

**The exercise.** Three questions, each answered by measurement.

1. **How safe is it?** Run the stack in many sampled worlds of the ODD, weighted by how often each kind of world
   occurs, and estimate the hazardous-event rate per hour of operation with a confidence interval (a Poisson count over
   simulated hours). With no events in T hours, the 95 % upper bound is about 3/T (the "rule of three").
2. **How much testing would a target need?** A target of one contact per 1 000 hours needs about 3 000 hours with no
   contact to claim at 95 %. At about 200× real time per core that is roughly 15 core-hours: possible in Node overnight,
   not in a lesson. The lesson runs a 10-hour target live and does the arithmetic for the rest, which is the honest
   version of why industry relies on scenario-based testing, and on importance sampling: oversample people-dense worlds,
   reweight by their exposure, and the same estimate needs a fraction of the runs. The learner does it both ways and
   compares the intervals.
3. **What predicts the harm?** Lagging indicator: contacts. Leading candidates: close approaches (gap under 0.3 m), the
   time the safety stop capped the speed, time-to-collision under 1 s, Localize amber time. Across the search's
   configurations the learner checks which leading indicator tracks the contact rate, and adopts it as an SPI with a
   threshold. Then a change that raises the SPI without yet causing a contact (narrower aisles) shows an SPI doing its
   job: the case is in trouble before anyone is hurt.

**Exists.** Contacts and the closest approach in the summary; the safety stop's capped seconds in `measure_per.py`
(page only); the Experiments tab's CSV.

**Missing.** Rates per simulated hour and their intervals (the runner, not the core); the leading-indicator counters in
the headless summary (C3); an SPI panel that shows the chosen indicators against thresholds across runs.

## 4. How it fits the page

The page has three modes (Simulate, Analyze, Learn; `src/ui/learn.js`), each of which changes what the stage shows, and
Tools tabs (Experiments, Train, Code) that work on runs while the map stays visible.

**Recommendation: both a Learn group and a Tools tab, not a fourth mode.**

- **Learn group `saf`**, "Safety", after `ctl`: the lessons of section 8 and a new chapter 8, "Safety: domains, hazards,
  scenarios and arguments", with the derivations the lessons link to (the rule of three and Poisson intervals,
  importance sampling, the robustness measures, the ASIL rule explained without the table).
- **Tools → Safety**, a tab with four sections that share one store: ODD sheets, the hazard log, Search (beside
  Experiments, reusing its worker pool, chart and map paths), and Arguments (the GSN graph and its evidence runs). The
  SPI view is a chart in Search.

Why not a mode: a mode replaces the stage, but safety work happens on simulation runs. A found scenario is opened on the
map, a red evidence node is rerun and watched, a hazard is pointed at in a replay. The Tools tabs already do this for
Experiments and Train. The one part that wants room is the argument graph; it can open in the plot dock at full height
or as an overlay on the stage with the map behind it. If, once built, it does not fit, promoting Safety to a mode is a
UI change, not a redesign; the owner revisited the question after phase 2 and kept the Learn group and the Tools tab,
to look again when the argument graph of phase 4 shows whether it needs the room (decision 4).

**Registering the group** touches, as for every group today: `GROUPS` in `tools/lessons.mjs`, the placeholder in
`src/analysis/lessons-data.js`, `SIM_LESSONS` in `src/analysis/lessons2.js`, `LESSON_GROUPS` in
`src/analysis/lessons.js`, `LESSON_LAYERS` in `src/ui/learn.js`, `LESSON_TERMS` and new `GLOSS` entries in
`src/analysis/glossary.js` (ODD, HARA, ASIL, SOTIF, triggering condition, functional insufficiency, FTTI, GSN, SPI,
residual risk, …), a subsystem colour (`[data-sys]` in `src/styles.css`, `SYS` in `src/ui/tabs.js`). Safety is not a
pipeline subsystem, so it gets no health light. Chapters are picked up in file-name order and Notation stays last
(decision 8): the safety chapter is `ch8-safety.md` and Notation becomes `ch9-notation.md` (`id: ch9`, `num: 9`). No
lesson or chapter links to `#notes=ch8/…` today, so the renumbering moves one file and its front matter.

## 5. What the lab already has, and what is missing

| Concept | Levels | Sensors and switchboard | Faults and settings | Other support | Missing |
| --- | --- | --- | --- | --- | --- |
| ODD | L2, L5 as the reference; generator families (rooms, warehouse, hall) as the domain's dimensions | GNSS availability, beacon density, weather as ODD attributes | `weather`, `people`, `vehicles`, `mu` | Level menu, links, Experiments | ODD sheet and check; sampling worlds from a sheet; runtime ODD monitor |
| HARA | L4 doorways, L5 aisles, L6 reversing, L7 avoidance | — | `people: 'reactive'` (controllability) | Contact counts, closest approach | Impact speed and event records (C1); exposure counters (C3); hazard log |
| Faults (26262) | L3, L5 | All seven switches; `SENSORS` registry with what each gives; health checks per switch | `odoB`, `gyroBias`, `bOff`, `bOut`, `gnssOut`, `lag`, `biasDeg`, `biasW`, `latency`, `sensLat` | Health lights, lost-guard, lidar safety stop, `sntest.py` | Timed faults in the core (C4); detection time in the summary (C5) |
| Triggering conditions (SOTIF) | L4, L5, L6, L7; generated worlds | Weather on lidar and radar; sonar specular, dead zone, crosstalk; GNSS multipath; radar clutter and ghosts | `weather`, `radClutter`, `radGhost`, `sonXt`, `gnssMp`, `assoc` + `clutter`, `unknownAs` | The matrix of 3.3 already taught across loc/per/plan/ctl | Event records with active conditions (C1); a monitor that notices them (C6) |
| AI (8800) | L2 → L4 shift; generated worlds | Learned detector reads the lidar; policy reads the scan | `detModel`, `predModel`, `polModel` | Models list their training runs; Train tab; policy safety layer with counters | Per-slice detection and prediction metrics in the summary; an out-of-distribution score |
| Scenario search | Generator; custom levels | Any switch as a search dimension | Every setting is an override | Worker pool, Experiments, Node harness, collectors | Search runner and refinement; robustness metrics (C2, C3); a person who steps out on a trigger (C7) |
| GSN argument | — | — | — | — | All of it: format, renderer, editor, evidence runner |
| Residual risk and SPIs | Generated worlds weighted by exposure | — | — | Contacts, closest approach, CSV | Rates and intervals; leading-indicator counters (C3); SPI chart |

Gaps the track exposes in the simulator itself, worth saying in the lessons: there is no camera (so no lighting or
glare as triggering conditions), no materials (the sonar's and radar's real strength, seeing glass, cannot show, as
per/09 already says), people are discs that walk straight segments, and nothing varies across the floor (grip is one
number for the whole level).

## 6. Core changes and their effect

The rule for every change: **observational or opt-in.** Nothing changes a default run, and any new randomness draws
from its own stream (as GNSS, sonar, radar and weather do), so the existing streams are not perturbed. Under that rule
the L1–L5 summary of `tests/test.py` stays byte-identical and `tests/node/golden.json` is untouched; that is the
acceptance test of every phase, and each PR says so with the before and after.

| | Change | Where | Behaviour change | L1–L5 baseline | Measured lesson numbers |
| --- | --- | --- | --- | --- | --- |
| C1 | Contact events: time, place, relative speed at contact, which bodies, and the settings and conditions active (weather, sensors off, faults), kept in `S.events`; the summary gains `events` and the worst impact speed | `vehicle.js` where contacts are counted; `runSummary` | None | Unchanged (the golden file keeps only its listed fields) | Unchanged |
| C2 | Smallest gap to a static obstacle (`minObs`), from a distance field of the true occupancy computed once per level, so the per-tick cost is one lookup per footprint circle | `vehicle.js` or `step.js`; `levelOf` builds the field | None | Unchanged | Unchanged |
| C3 | Leading indicators: seconds with a person closer than 0.3 m, smallest time to collision with a person (true positions, constant velocity), seconds in each situation of 3.2 (person within 2 m, in a doorway, reversing), seconds the safety stop capped the speed (today counted only in `measure_per.py`) | `step.js`, `runSummary` | None | Unchanged | Unchanged |
| C4 | A fault schedule: `events: [{t, set: {…}}, {t, act: 'kidnap'}]` in a Try cfg, a worker run and level settings, applied at the start of the tick it names; the page's `act` moves onto it | `config.js`, `step.js`, worker protocol; `src/ui/panes.js` | Only when used | Unchanged | loc/03, loc/04 and loc/07 use `act`: if the kidnap moves from the page to the core it must happen on the same tick in the same order, and those lessons are re-measured before the change merges |
| C5 | The health lights' state as data in the core (the rules are in `src/ui/health.js` today, page side), so the summary can report when each light first turned amber or red | Move the rules' computations into `core/`, keep the drawing in `ui/` | None | Unchanged | Unchanged |
| C6 | Optional ODD monitor (`P.oddMon`, off by default): observable ODD attributes (lidar return ratio, tracked people's speed, GNSS σ, beacon silence) checked against the active sheet; outside it, a minimal-risk manoeuvre (slow to a crawl, or stop where the costmap says the robot is out of a lane) | New `core/oddmon.js`; `dispatch.js` speed stack | Only when on | Unchanged (off by default) | Unchanged; the safety lessons measure their own |
| C7 | People with a trigger: `mode: 'trigger'`, `when: {near: [x, y], r}`: the person waits until the robot is within r of the point, then walks; the generator can place them behind racks | `levels.js` format and validation, `state.js` people update, `worldgen.js` | Only in levels that use it | Unchanged (no built-in uses it) | Unchanged |

Format note for C7: the level format stays at version 1 with the extra mode; a page older than the change rejects such a
level with its existing "mode is shuttle or pause" message, which is acceptable for a single-build project. The
round-trip test (`tests/node/levels.test.mjs`) gains a case.

Lesson numbers: the safety lessons measure their own numbers with `tests/measure_saf.mjs` (the headless core in
Node: a Try's cfg run seed by seed to Mission complete, with the safety measures), single seed-7 runs as everywhere
with the other seeds for the Predicts, and the search's numbers from `tools/search.mjs`. A new gate
script `tests/saftest.py` would press every Safety tool (sheet check, a 20-sample search, an argument rerun, export and
import) and join `run_all.py`, which then runs ten scripts; CLAUDE.md and `docs/maintaining.md` say nine today and are
updated in the same PR.

**Page size.** `dist/nav-stack-lab.html` is 4.33 MB at v59 (models 0.90 MB, lessons 0.72 MB, chapters 0.57 MB, the
embedded worker source 0.48 MB, fonts 0.22 MB). Estimate for the whole track: nine lessons at about 11 KB of markdown
each, inlined at the current 1.45 ratio, about 145 KB; the chapter, about 30 KB of markdown at the chapters' 2.2 ratio
with MathML, about 65 KB; the Safety tab (sheets, hazard log, search, GSN renderer and editor, SPI chart) about 75 KB;
the core additions about 12 KB, counted twice because the page embeds the core's source for its workers; glossary
entries about 10 KB. Total about 320 KB, so the page grows to about 4.65 MB (+7 %). `dist/core-worker.js` grows by
about 12 KB. There is no stated byte budget; the roadmap's notes on size concern the models (4.5 MB "with three
models" for the policy at the time). If 4.65 MB is too much for the phone, the cheapest saving is the models' export
(float16 weights would roughly halve the 0.9 MB), which is independent of this track. The owner accepted the growth
(decision 5).

## 7. Overlap with the roadmap

`docs/roadmap.md` names no standard, ODD, hazard analysis, scenario search or residual risk; it has these items that
the track touches:

- **Safety: the lidar safety stop as a default once tuned not to fire in normal runs** (Candidate next steps; the
  reason it is off is in "Moose test, MPC with the tyre model, lidar safety stop": on, it fires near pillars and shelves
  and changes the L1–L5 regression). This is lesson 7's material: the stop is a mitigation whose price is false stops,
  the SOTIF trade between the hazard and the function's availability, and the search is the tool to tune it. The tuning
  ships inside the track (decision 7), opt-in: the track does not make the stop the default (that changes the baseline,
  a separate decision); it measures the trade and leaves the default to that roadmap item.
- **The radar's time to contact: "an emergency brake on it is the obvious next use"** (Radar and weather, limits). A
  second mitigation for lesson 7, measured against the same scenario set, built inside the track (decision 7). It is a
  behaviour change, opt-in like C6.
- **The residual contact of the speed planner, a person reversing at the end of their walk** (Moving agents, results).
  The track's first known-unsafe scenario, and the predictor lessons' motivation seen from the safety side.
- **"the tyre-model MPC does not brake for a swerve it cannot make"** and **"the moose obstacle detected late"**
  (Vehicle dynamics, next; L7's known limit). Insufficiencies for the 3.3 matrix; the "speed profile that takes μg" is
  the mitigation, and stays a vehicle-dynamics item.
- **Unknown space as lethal** (the lidar safety stop section). A fail-safe design choice that lesson 7 can show:
  treating the unknown as an obstacle trades mission time for one hazard class.
- **Environments: lessons and Train recipes on generated worlds.** The safety track would be the first lessons that use
  generated worlds, which settles the open problem of how a Predict on a generated world holds at other seeds
  (decision 9).
- **Learning tracks: distribution shift (grippy → slippery, L2 → L4) and debuggability.** Lesson 5 (ISO/PAS 8800) is
  the distribution-shift lesson that item asks for; the per-slice metrics it needs serve both.
- **Sensor noise that follows the weather** (Sensors, next). Each new weather effect is a new triggering condition; the
  matrix of 3.3 is where it gets taught.
- **Health lights** (7.6 Health). The lights become the stack's monitors in the 26262 sense (C5 moves their logic into
  the core); their rules stay as they are.

When the track starts, the roadmap gets a "Safety lab" section with the design notes per phase, as for every feature,
and the Candidate next steps line points here.

## 8. Phased plan and draft lesson list

Each phase is one or more PRs released the usual way (`docs/maintaining.md`): the release commit, the gate, the merge,
the republish. Each phase ends with something a learner can use.

**Phase 0, this document.** Decisions recorded (section 9); clause numbers confirmed by the owner (section 10).

**Phase 1, the vocabulary on what exists.** Core: C1, C2, C3 (observational; baseline unchanged). Page: the `saf` group,
the glossary, the safety chapter's first sections (and Notation renumbered to chapter 9), the Experiments tab's new metrics (impact speed, `minObs`, close-approach
seconds). Lessons 1, 2 and 3, built from existing levels and settings (the faults lesson moved to 4, so that
phase 2 adds lessons after the existing ones and the saved progress, which is kept by position, does not shift). The ODD sheet and hazard log are written in the
lessons as tables; the tools come later.

**Phase 2, faults in time, and search.** Core: C4 (with the page's kidnap and scatter moved onto the schedule, and
loc/03, loc/04 and loc/07 re-measured in the same PR; decision 10), C5, C7. Page: Tools → Safety with ODD sheets (check and sample) and
Search (random, refinement, the worst cases with Open, saved scenario sets), `tools/search.mjs`, `tests/saftest.py`.
Lessons 4 and 6, which became 4 and 5 (the search moved before the learned blocks, so phase 3 appends its lessons).

**Phase 3, the learned blocks and mitigations** (built, v64). Per-slice metrics for the detector and predictor; an
out-of-distribution score for all three learned blocks from the training runs the model files list, with a health
check; the radar emergency brake as an opt-in mitigation. Lessons 6 (learned blocks) and 7, chapter 8 §8–§9. The lidar
safety stop's tuning (decision 7) became a measurement in lesson 7 rather than a change: in fog it inherits the
lidar's blindness, which no tuning fixes.

**Phase 4, risk and the argument** (4a built, v65: rates with intervals, importance sampling, the leading indicators'
ranking and chart, lesson 8; 4b built, v66). Rates with intervals and importance sampling in Search; the SPI chart; the GSN
format, renderer, editor and evidence runner, with arguments, ODD sheets, hazard logs and scenario sets stored in the
browser like custom levels, with JSON export and links (decision 6); C6, the ODD monitor, off by default (decision 11).
Lessons 8 and 9, and the rest of the safety chapter.

Draft lessons (titles in the lab's style; each with Trys, Predicts, Think about and Check yourself):

| # | Title | Standards | Built on |
| --- | --- | --- | --- |
| saf/01 | What the stack was built for: the operating domain | UL 4600 cl. 8; ISO 21448 cl. 5 | L5; generated warehouses inside and outside the sheet; fog |
| saf/02 | Hazards and risk: from situations to safety goals | ISO 26262-3 cl. 6; ISO 21448 cl. 6; UL 4600 cl. 6 | L4, L5, L6, L7; scripted against reactive people; impact speeds (C1) |
| saf/03 | Nothing breaks, and it still fails: triggering conditions | ISO 21448 cl. 4, 7, 8 | The matrix of 3.3, with and without each condition on the same seeds |
| saf/04 | Something breaks: detect it, react, in time | ISO 26262-1 cl. 3 (FTTI), 26262-4 cl. 6, 26262-9 cl. 8 | L3, L5; the switchboard in mid-mission (C4); health-light times (C5) |
| saf/05 | Looking for the failures nobody wrote down | ISO 21448 cl. 9, 10, 11, 12; UL 4600 cl. 12 | Search over generated warehouses; the person who steps out (C7) |
| saf/06 | Learned blocks: the data is the specification | ISO/PAS 8800 cl. 9, 11, 12, 13 | Detector and policy across L2, L4, fog and generated rooms; the Train tab |
| saf/07 | Mitigations, and what they cost | ISO 21448 cl. 8 | The lidar safety stop, the radar brake, unknown as lethal, a smaller ODD; false stops against contacts |
| saf/08 | How many hours make it safe enough | ISO 21448 6.5, cl. 9, cl. 12; UL 4600 cl. 16 | Rates and the rule of three; importance sampling; leading indicators |
| saf/09 | The safety argument: claims, evidence, and what breaks it | UL 4600 cl. 5; ISO 26262-2 6.4.8; ISO/PAS 8800 cl. 8; GSN v3 | The argument for L5 in ODD-1, live evidence, one setting changed |

## 9. Decisions

The owner's answers to the design questions (2026-10-22). Question 2, the clause numbers, is section 10.

| # | Question | Decision |
| --- | --- | --- |
| 1 | Which standards | Only the four: ISO 26262, ISO 21448, ISO/PAS 8800 and UL 4600. No sidebar on the robot-specific standards, and no companion standards cited; GSN is used as a notation only. |
| 2 | Clause numbers | First: the owner checks them in section 10, and no lesson cites an unchecked row. Changed 2026-10-22 (the licensed texts are not available here): the lessons and chapter cite the best available numbers of section 10, say that they come from public outlines and are unchecked, and a row is corrected wherever it is cited once someone checks it. Changed 2026-10-30: the lessons and the chapter cite no clause numbers at all (the owner found bare clause numbers confusing for a reader who cannot open the texts); the numbers stay in section 10. |
| 3 | Severity scale | The lab's own scale from the relative speed at contact, labelled as the lab's: under 0.3 m/s, 0.3–1 m/s, over 1 m/s. |
| 4 | Tools tab or mode | A Learn group `saf` plus Tools → Safety. Revisited after phase 2 (2026-10-24): it stays so, since the safety work happens on runs the map shows; looked at again with phase 4, once the GSN graph shows whether it needs a mode's room. |
| 5 | Page size | About +320 KB (to about 4.65 MB) accepted; the models' lighter export stays a separate item. |
| 6 | Persistence | ODD sheets, hazard logs, scenario sets and arguments are stored in the browser (IndexedDB, like custom levels) with JSON export and links. |
| 7 | Roadmap mitigations | The radar emergency brake and the lidar safety stop's tuning are built inside the track as lesson 7's mitigations, opt-in, with default runs unchanged. |
| 8 | Names | Group id `saf`, title "Safety"; the safety chapter is chapter 8 and Notation moves to chapter 9, so it stays last. |
| 9 | Predicts on searches | Predicts ask only about properties that hold at any seed, never about one found scenario. |
| 10 | The kidnap in the core | The page's kidnap and scatter move onto the core's fault schedule (C4); loc/03, loc/04 and loc/07 are re-measured in the same PR. |
| 11 | The ODD monitor | In scope for phase 4 (C6), off by default. |

## 10. Clause numbers to confirm

Note, 2026-10-30: the lessons and chapter 8 no longer cite these numbers (the owner found bare clause numbers confusing for a reader who cannot open the texts), so a correction here changes only this document. The "Where cited" column records where each number was cited until then.

Every clause number this document and the draft lessons cite, against the 2018 edition of ISO 26262, ISO 21448:2022,
ISO/PAS 8800:2024 and the third edition of ANSI/UL 4600 (2023). None was checked against a licensed copy: the
"Checked against" column says what each one rests on, from strongest to weakest:

- **Public contents.** A public table of contents or preview names the clause.
- **Secondary, agreed.** Two or more published descriptions (papers, training material, vendor guides) agree on the
  number.
- **Secondary, one.** One published description gives the number.
- **Secondary, disagree.** Published descriptions give different numbers.
- **Memory.** From the author's knowledge of the standard, not found in any public source during this check.

The topic column is this document's own paraphrase of what the clause is about. Fill in the last column: `OK`, or the
right number (and title if it differs). Since decision 2 changed, the lessons cite every row at its best available number, marked as such in this column; a correction changes the row and every place it is cited.

| # | Standard | Clause cited | Topic, as this document uses it | Where cited | Checked against | Your answer |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ISO 26262-1 | 3 | Terms and definitions, including the fault tolerant time interval | 3.3; saf/04 | Memory | best available, unchecked (owner, 2026-10-22) |
| 2 | ISO 26262-2 | 6.4.8 | The safety case | 3.5; saf/09 | Contents page of the 2018 edition: 6.4.8 is "Safety case", under clause 6, project-dependent safety management | OK (confirmed from the contents page) |
| 3 | ISO 26262-3 | 5 | Item definition | 2 | Memory | best available, unchecked (owner, 2026-10-22) |
| 4 | ISO 26262-3 | 6 | Hazard analysis and risk assessment | 3.2; saf/02 | Public contents (ANSI preview of Part 3) and secondary, agreed | best available, unchecked (owner, 2026-10-22) |
| 5 | ISO 26262-3 | 6.4.3 | Classifying hazardous events by severity, exposure and controllability | 3.2 | Secondary, agreed | best available, unchecked (owner, 2026-10-22) |
| 6 | ISO 26262-3 | 6.4.4 | Determining the ASIL | 3.2 | Memory | best available, unchecked (owner, 2026-10-22) |
| 7 | ISO 26262-3 | 6.4.5 | Safety goals | 3.2 | Memory | best available, unchecked (owner, 2026-10-22) |
| 8 | ISO 26262-4 | 6 | Technical safety concept: safety mechanisms, safe state | 3.3; saf/04 | Memory | best available, unchecked (owner, 2026-10-22) |
| 9 | ISO 26262-9 | 8 | Safety analyses (inductive and deductive: FMEA, FTA) | 3.3; saf/04 | Memory | best available, unchecked (owner, 2026-10-22) |
| 10 | ISO 21448 | 4 | Overview of SOTIF activities; the four areas (known or unknown, safe or unsafe) | 3.3; saf/03 | Secondary, one, which places the four areas in the Introduction, not clause 4 | best available, unchecked (owner, 2026-10-22) |
| 11 | ISO 21448 | 5 | Specification and design, including the conditions of use | 3.1; saf/01 | Secondary, one | best available, unchecked (owner, 2026-10-22) |
| 12 | ISO 21448 | 6 | Identification and evaluation of hazards | 3.2; saf/02 | Public contents | best available, unchecked (owner, 2026-10-22) |
| 13 | ISO 21448 | 6.3 | Hazard identification | 3.2 | Public contents | best available, unchecked (owner, 2026-10-22) |
| 14 | ISO 21448 | 6.4 | Risk evaluation | 3.2 | Public contents | best available, unchecked (owner, 2026-10-22) |
| 15 | ISO 21448 | 6.5 | Acceptance criteria for the residual risk | 3.2; 3.6; saf/08 | Public contents | best available, unchecked (owner, 2026-10-22) |
| 16 | ISO 21448 | 7 | Functional insufficiencies and triggering conditions, and whether the response to them is acceptable | 3.3; saf/03 | Secondary, agreed | best available, unchecked (owner, 2026-10-22) |
| 17 | ISO 21448 | 8 | Functional modifications that address SOTIF risks (better function, restricted use, minimal-risk behaviour) | 3.3; saf/03; saf/07 | Secondary, disagree (one source puts acceptance criteria here) | best available, unchecked (owner, 2026-10-22) |
| 18 | ISO 21448 | 9 | Verification and validation strategy, validation targets | 3.4; 3.6; saf/08 | Secondary, disagree (one source puts design measures here) | best available, unchecked (owner, 2026-10-22) |
| 19 | ISO 21448 | 10 | Evaluation of known scenarios | 3.4; saf/05 | Secondary, agreed | best available, unchecked (owner, 2026-10-22) |
| 20 | ISO 21448 | 11 | Evaluation of unknown scenarios | 3.4; saf/05 | Secondary, agreed | best available, unchecked (owner, 2026-10-22) |
| 21 | ISO 21448 | 12 | Evaluating whether SOTIF is achieved (the residual risk) | 3.4; 3.6; saf/08 | Secondary, agreed | best available, unchecked (owner, 2026-10-22) |
| 22 | ISO 21448 | 13 | Activities in operation | 3.1; 3.6 | Memory | best available, unchecked (owner, 2026-10-22) |
| 23 | ISO 21448 | Annex (no letter cited) | Informative guidance on verification and validation: from a target to an amount of testing | 3.6 | Memory (believed to be Annex C) | best available, unchecked (owner, 2026-10-22) |
| 24 | ISO/PAS 8800 | 8 | Assurance argument for the AI system | 3.5; saf/09 | Secondary, agreed | best available, unchecked (owner, 2026-10-22) |
| 25 | ISO/PAS 8800 | 9 | Deriving the AI system's safety requirements | 3.1; saf/06 | Secondary, agreed | best available, unchecked (owner, 2026-10-22) |
| 26 | ISO/PAS 8800 | 11 | Data-related considerations (requirements on data, coverage) | 3.1; saf/06 | Secondary, agreed | best available, unchecked (owner, 2026-10-22) |
| 27 | ISO/PAS 8800 | 12 | Verification and validation of the AI system | saf/06 | Secondary, agreed | best available, unchecked (owner, 2026-10-22) |
| 28 | ISO/PAS 8800 | 13 | Safety analysis of AI systems (causes of AI errors) | 3.3; saf/06 | Secondary, agreed | best available, unchecked (owner, 2026-10-22) |
| 29 | ISO/PAS 8800 | 14 | Measures during operation | 3.6 | Memory (sources list clauses up to 15 but this title was not seen) | best available, unchecked (owner, 2026-10-22) |
| 30 | UL 4600 ed. 3 | 5 | Safety case and arguments | 3.5; saf/09 | Public contents of edition 2 (ANSI listing); edition 3 assumed unchanged | best available, unchecked (owner, 2026-10-22) |
| 31 | UL 4600 ed. 3 | 6 | Hazards and risk assessment | 3.2; saf/02 | Public contents of edition 2 (ANSI listing); edition 3 assumed unchanged | best available, unchecked (owner, 2026-10-22) |
| 32 | UL 4600 ed. 3 | 8 | Autonomy functions and support, including the ODD and sensing | 3.1; saf/01 | Public contents of edition 2 for sensing; where the ODD sits within it: memory | best available, unchecked (owner, 2026-10-22) |
| 33 | UL 4600 ed. 3 | 12 | Verification, validation and test | 3.4; saf/05 | Memory | best available, unchecked (owner, 2026-10-22) |
| 34 | UL 4600 ed. 3 | 16 | Metrics and safety performance indicators | 3.6; saf/08 | Secondary, agreed (one cites a subclause of 16 by number) | best available, unchecked (owner, 2026-10-22) |

## Sources for the clause outlines

Public descriptions used to check the clause structure (none of them reproduces the standards' text, and nor does
this document):

- ISO 26262-3:2018 preview pages, ANSI webstore: https://webstore.ansi.org/preview-pages/ISO/preview_ISO+26262-3-2018.pdf
- ISO 21448:2022 clause structure as described in "Towards more efficient quantitative safety validation of residual
  risk for assisted and automated driving", https://arxiv.org/pdf/2506.10363
- ISO/PAS 8800:2024 overview, LHP: https://www.lhpes.com/blog/what-is-iso-pas-8800
- UL 4600 edition 3 announcement, UL: https://www.ul.com/news/ul-4600-edition-3-updates-incorporate-autonomous-trucking
- UL 4600 safety performance indicators, clause 16: http://safeautonomy.blogspot.com/2021/06/a-more-precise-definition-of-ansiul.html
