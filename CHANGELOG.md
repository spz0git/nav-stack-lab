# Changelog

The version label in the page header (`v54 · 2026-10-20`) is the number used here; `src/version.json` holds it.
The page shows this file under the label (What's new): keep each entry readable by someone who uses the page.
Design notes per feature are in [docs/roadmap.md](docs/roadmap.md).

## Unreleased

- On a phone, the level menu now opens in the page, right under the level button, and scrolls with the rest of the
  page. In the Claude app on iPhone, picking a floor and closing the menu could leave the page unable to scroll back
  up. A touch elsewhere on the page no longer closes the menu, so you can scroll through a floor's experiments; close
  it with × or the level button.

## v81 · 2026-11-04

- On a phone, the level menu no longer leaves the page looking stuck. Swiping on the menu after picking a level used
  to scroll the page hidden behind it, so nothing on screen moved. Now a swipe only scrolls the menu itself, the menu
  has a × to close it, and its last lines are no longer hidden behind the bottom bar.

## v80 · 2026-10-31

- Chapter 4 has a new section, *Speed planning: the ST graph* (§6), on how the robot slows and waits for people
  without leaving its path: the grid of time against distance along the path, the cost of each cell near a predicted
  person, the search for the cheapest speed profile, when it gives up and asks for a new path, and a worked encounter
  in which a person turns back toward the robot. The later sections of the chapter move up by one.
- Control → Response to agents now lists all four options with every controller and dims the ones it cannot use, with
  the reason when you hover or tap: with MPC, velocity obstacles and the reactive stop; with DWA or your own
  controller, everything but its own handling of people. Before, the row was missing for DWA and showed only two
  options for MPC.

## v79 · 2026-10-31

- With the lidar switched off (Sensors) and the radar on, setting Perceive → Tracker inputs to Radar now tracks people
  from the radar alone, so speed planning and velocity obstacles can still give way to them. Before, the tracker
  waited for lidar scans that never came, and the robot drove straight through people. The radar only looks ahead,
  so someone coming from the side or behind is seen late or not at all. With the lidar off and Tracker inputs left
  on Lidar, the health panel and the Perceive tab now say how to switch.

## v78 · 2026-10-31

- Every switch of options (Agent tracking, Map source, Simulate · Analyze · Learn, the plot and log pickers) now fills
  the option that is on with blue, so which one is chosen reads at a glance. With agent tracking off, the Perceive
  tab says so first and offers a button to turn on lidar tracking.

## v77 · 2026-10-31

- Custom level → Generate: the number fields now line up, each label beside its box in even columns, so the form
  reads as a table instead of a ragged run of fields.
- The first-run hint gives the first pass's length as Start here counts it (99 minutes since the lessons were
  rewritten; it said 95).

## v76 · 2026-10-31

- The nine chapters are rewritten in plainer prose, as the lessons were in v72 and v75: long sentences split, the
  reason next to the fact, every term explained where it first appears, and a few skipped steps written out. No
  heading, equation, table, live value or measured number changed.
- Corrections found on the way, in the chapters and the lessons that point at them: a late lidar scan is placed
  from an estimate that lags with it, so the walls smear rather than shift (perception lesson 4 and chapter 3 §7,
  measured headless); a diagonal space-time move takes one step, checked at both ends; velocity obstacles sample 77
  candidates; the chamfer distance errs on the unsafe side and the lethal margin covers it; a radar update leaves an
  ellipse stretched across the line of sight; pure pursuit's short-lookahead oscillation comes from the delays, not
  from lost damping; and the Butterworth damping of LQR holds for any weight ratio when only position is weighted.

## v75 · 2026-10-31

- All 45 lessons on control, localization, perception and planning are rewritten sentence by sentence in plainer
  prose, as the safety lessons were in v72: shorter sentences, the reason next to the fact, terms explained where
  they first appear, and no slogans. No measured number, table, experiment or answer changed. A few slips were
  fixed on the way: which wheel error makes odometry overestimate, what the PID tracker integrates, where the
  gyro's controls are (the Sensors tab), and the standard deviation of an averaged GNSS fix.

## v74 · 2026-10-31

- The safety lessons show their results where you read them. A search Try lists its five worst runs under its
  button when it is done; an argument Try draws the safety argument there as it checks, and a button takes you to
  the Safety tab for the chart, the rates and the editor. You no longer have to switch to Simulate to see what
  happened.
- A red claim in the safety argument now leads to the run that broke it. Pick a node and the solutions under it
  that failed are listed with the runs that count against each: the world and seed, and what happened. Open plays
  that run on the map from 3 s before its contact and pauses at the contact (Pause on contact is ticked for you).
  The search's Open buttons do the same.

## v73 · 2026-10-31

- Safety lesson 8's last prediction asks which of the four measures ranks last, and now lists all four: the
  time to contact under 1 s was missing from the choices.

## v72 · 2026-10-30

- The nine safety lessons are rewritten sentence by sentence into plainer prose: shorter sentences, the reason
  next to the fact, no slogans. No measured number, table or experiment changed. Lesson 2 walks through why each
  hazardous event on the busy floor gets its classes, and lesson 8 says what rate would be acceptable and how far
  the measured one is from it.
- Safety lesson 5 (searching the domain) explains the margin with an example, the two halves of a search as steps,
  and gives a tour of the Safety tab from the top: the sheet, Search, the chart, the worst runs and their Open
  button, scenario sets and Rerun. Each search Try says what to expect when you press it. A search started from a
  lesson now shows its progress under the Try button and in the event log, and reports its result there when it
  ends; opening the lesson no longer starts a search by itself.
- Safety lesson 6 (learned blocks) opens with what the three learned blocks are and why their data is their
  specification, says what a slice is and what the monitor does before giving its formula, defines recall from
  true positives and false negatives, and explains the hand-written detector the learned one replaces and the
  out-of-distribution score the first Try plots.
- Safety lesson 4's lidar Try shows the lidar layer, so you see the scans vanish when the lidar fails at 30 s.
- A lesson's header has a Previous lesson button beside Next lesson. Along the first pass it steps back along the
  first pass (Previous in the first pass); the first lesson of the list has no Previous button.
- The health lights in the status strip always carry their name: Loc, Per, Plan and Ctl beside a lesson and at
  mid widths (Localize, Perceive, Plan and Control where there is room), and the sensors' names stay beside their
  dots in Learn too. At mid widths the strip no longer squeezes the status figures; the lights wrap to their own row.
- The seeds a lesson quotes are explained on tap in every lesson that uses them: the world seed (the generated warehouse),
  the run seed (Vehicle → Random seed) and the search seed (Tools → Safety), and under Terms and symbols at the end of
  the lesson. Chapter 8 has a short section, The three seeds, with how they fit together.
- The safety lessons no longer list clause numbers from the standards. Each says in a few plain sentences which
  standard its exercise comes from, what that standard asks for at this step and why. Chapter 8 §1 now introduces
  the four standards once: who publishes each, which edition the lab follows, what it is for, and a link to its
  official page.

## v71 · 2026-10-29

- In the safety lessons, every mention of the Metrics list is a link: it opens the telemetry dock and marks the row
  the lesson talks about (on a phone it takes you to the dock under the map). Lesson 3 now says in place what each
  safety measure counts, instead of sending you to chapter 8 for it.
- Safety lesson 1 explains the two seeds the lessons quote: the world's seed fixes the warehouse and the people's
  routes, the run seed (Vehicle → Random seed) fixes the noise, so the same seed replays the same run.
- A link opened in the address bar right after you change something on the page (a lesson, a setup) opens
  as it should; the page's own update of the address no longer overwrites it.
## v70 · 2026-10-29

- Safety lesson 2 (hazards and risk) now says what each symbol in its relative-speed and exposure equations means,
  and lists them under Terms and symbols.
- Safety lesson 2 shows how an integrity level is worked out, in tables: the lab's touch, bump and strike against
  the standard's severity classes and the level each sum of severity, exposure and controllability gives. It then
  walks through the analysis in four steps and builds L5's hazard log: four situations, four hazardous events rated
  class by class with the reason for each rating, and the safety goal they lead to (level C). Chapter 8 §3 gives the
  same classes in words.
- Safety lesson 2 spells out controllability: the people exposed, everyone nearby and not only a driver, with the
  robot's own reaction left out, since that is what the analysis rates. The robot's side gets its own name and
  equation, the avoidance margin: time to contact minus the time the robot needs to stop.
- The level menu fades out at the bottom while there is more to scroll, in the level list and in the quick
  experiments, so a line cut off at the edge reads as "scroll for more".
- Check yourself takes an answer within 5 % of the exact one as close enough and shows the exact value, so a
  rounded or slightly off working still counts. Questions that ask for an exact count still need it exactly.

## v69 · 2026-10-26

- The page is about 0.9 MB lighter (4.7 → 3.8 MB; 1.41 → 1.20 MB compressed): it no longer carries the simulation
  core twice, and the end-to-end policy's weights take half the space with exactly the same values.
- The run logs in a lesson's "What you will see" are small tables now, one row per run or seed with a line saying
  what to look at: in the dead-reckoning, pose-graph SLAM, learned detector, radar and D* Lite lessons and throughout
  the safety lessons. Chapters 3 (perception), 4 (planning) and 6 (the tracking loop) read more easily: their long
  sentences are split, and no claim, number or equation changed.
- Picking Experiments, Train, Safety or Code no longer makes the settings panel jump: the tab row keeps the same
  height whichever tab is open. Between phone and desktop widths, and on short desktop windows, the header shows
  Changed, Runs and View again.
- Screen readers announce new contacts, faults, warnings and the mission's end from the event log. With "reduce
  motion" set in your system, highlights appear and disappear without fading, and the splitters and progress bars
  stop animating.
- The first-run hint counts the levels correctly (L1 to L7 and your own) and points to Learn's Start here. The search
  footer says "1 result". The Code tab says what to do when no code is loaded.
- A setup link whose goals are not numbers keeps the level's goals and says so in the log, instead of planning to a
  goal at "NaN m"; a link with a name such as `constructor` in it no longer fails as a whole.

## v68 · 2026-10-26

- Keyboard: the settings tabs are one stop for Tab, and the arrow keys (with Home and End) move between them; Enter
  and Space keep the focus on the tab. The down arrow opens More and moves through its menu, and Escape returns to
  More. Space on a button or tab you reached with the keyboard presses it instead of starting the run. In the search
  box, Tab stays inside while it is open and Escape closes it wherever the focus is.
- Phones: Changed (with its per-setting reset), Runs and View are in the Settings sheet's header, next to a close
  button. The Mission tab's state diagram is shown full size and scrolls sideways, so its labels are readable; the
  level menu shows every floor at once instead of a strip cut off at the edge.
- Eight lessons (two on the car with tyre slip, the moose test, log-odds mapping, people who react, A*, Hybrid A*
  and the Kalman update) now say which seed and run their numbers come from, as the others already did.
- New glossary terms, shown on hover or tap in the lessons that use them: Frenet equations, inscribed-angle theorem,
  argument principle, describing function, Lyapunov argument, Padé approximation, Joseph form, Bresenham's algorithm
  and lock-in. The zero of a transfer function is explained from the first control lesson on.
- Chapter 9's reference list adds the eleven works the lessons cite by name (ALVINN, the two imitation-learning
  papers behind DAgger, DART, multimodal trajectory prediction, mixture density networks, velocity obstacles and
  reciprocal velocity obstacles, D* Lite, frontier exploration, and Samson's rear-wheel feedback law).
- The minutes beside each lesson count all of its text and a minute per experiment, so they say how long a lesson
  really takes; the first pass in Start here is about 95 minutes with the experiments.
- The safety lessons give UL 4600's third edition with its year (2023), and the safety-argument lesson says that
  ISO 26262-2 6.4.8 (the safety case) is confirmed.

## v67 · 2026-10-26

- Fixes from the audit of v66 (the assessment is in the repository under docs). A setup link, a level file or a fault
  schedule can no longer set a value that breaks the run, such as a negative latency (which froze the page), an empty
  MPC horizon, a car with no mass or millions of particles: the value is ignored and the event log says which one and
  why. A level whose settings name something the page does not have loads with that setting left out, and the log
  names it. If the simulation hits an internal error, the run pauses and the error appears in the event log instead of
  the robot standing still with nothing said.
- A fault schedule's change now takes full effect at its moment: a new inflation radius rebuilds the costmap and
  replans, a planner or vehicle change replans, as moving the slider does.
- Leaving a planning lesson's search playback for another lesson, Analyze or another level stops the playback; on a
  phone it filled the console with errors. The "Where it comes from" links in lessons wrap, so they are no longer cut
  off at the panel edge or make a phone page scroll sideways. The map key (?) closes with Escape and when you switch
  mode or level.
- The self-checks of the learned detector and learned predictor lessons accept the right answer; before, no answer
  could complete them.
- The noise letters are the same everywhere: Q for measurement noise, R for noise added to the state, M for odometry
  noise, in the GNSS chapter and lesson, the How it works panels and the glossary; the notation chapter's table says
  where other books swap them. The PID gains are written k_p, k_i, k_d throughout.
- Corrected numbers and links in the chapters: the gyro-bias drift after a minute (12.6 m), two chapter links that
  pointed one section off, figures that disagreed with their lesson, and introductions that now cover every section.
  In the radar lesson each "Before you press" question sits under the experiment it asks about; the dead-reckoning
  question asks about ten minutes of driving, where its answer holds at every seed; the Bode-plot measurement sets up
  its own loop; the first control lesson states the lookahead its crossover was read at; the safety-hours lesson says
  why its two 95 % bounds differ.

## v66 · 2026-10-24

- Safety, the last lesson, *The safety argument: claims, evidence, and what breaks it*: the busy floor's safety case
  drawn as a graph of claims and evidence, every piece of evidence a run the page reruns. One claim fails as it stands
  (a rack bumped on one seed in six); people who don't give way break the claims about people; switching the ODD
  monitor off breaks the claim that the robot notices fog; a defeater, people who step out, adds a gap nobody had tested.
- Tools → Safety → Safety argument: draw, edit and check an argument; open it full width; save it as JSON or share it
  as a link. Arguments, ODD sheets (Save as) and scenario sets are now kept in this browser.
- Mission → ODD monitor (off by default): when the robot can see it has left its operating domain (fog, or a learned
  block reading unfamiliar input), it crawls or stops until it is back inside. Tools → Safety can point it at any sheet.

## v65 · 2026-10-24

- Safety, lesson 8, *How many hours make it safe enough*: the busy floor's rate of contacts per hour of operation with
  its 95 % interval (about 14 an hour), a stack with nothing left to count and what that silence is worth (the rule of
  three: about 3 000 hours without a contact to claim fewer than one per thousand), importance sampling and the price
  of its weights, and which measure warns before anyone is hurt.
- Tools → Safety: after a search, a Risk table rates the random runs per hour with their intervals and says how many
  hours a claim would need; an importance-sampling option; the leading indicators ranked against the contacts, the
  best one charted run by run.

## v64 · 2026-10-24

- Safety, two more lessons:
  - *Learned blocks: the data is the specification*: the learned people detector, predictor and policy measured by
    slice instead of by one number, and watched for inputs unlike their training data. In fog a new health light says
    within half a second that the detector is outside what it was trained on; the policy's watch never notices the
    people it was not trained with.
  - *Mitigations, and what they cost*: a radar emergency brake removes every strike in fog on six seeds, at the price
    of stops for clutter; the lidar safety stop inherits the fog's blindness; a slower cruise speed makes things worse.
- Control → Radar emergency brake (off by default): stops for a radar echo in the way that would arrive sooner than the
  time to contact allows.
- The Metrics list shows the people found by range, the prediction error for people who walk on and people who change
  course, each learned block's out-of-distribution score, the brake's stops, and contacts where a person walked into
  the stopped robot.
- Fix: Experiments listed none of the settings that moved to the Sensors tab in v62.

## v63 · 2026-10-23

- Every tab in the pipeline row is numbered now, Sensors (1) through Vehicle (7), in the order the data flows.
- On a narrow settings panel the tabs wrap onto a second line instead of hiding More off the edge.

## v62 · 2026-10-23

- A Sensors tab, first in the pipeline row: every sensor's switch, noise and specs in one place, so Localize keeps
  only the estimators. It gathers the odometry and the gyro, the lidar, the beacons and their sensor sheet, GNSS, the
  ultrasonic ring and the radar (until now in Localize, Perceive and Vehicle), the weather, and the sensor latency.
  The sensor dots beside the health lights open it.
- Noise profiles in the Sensors tab: *Perfect* (no noise, bias, dropouts, clutter, outages or multipath on any
  sensor), *This level's* and *Rough* (cheap, worn sensors), each with one tap; the specs stay as they are.
- Two new lidar specs: its reach (2 to 8 m; beyond it a surface returns nothing and the map learns only that the
  floor is free out to there) and dropouts (a share of beams that return nothing at random).

## v61 · 2026-10-22

- Safety, two more lessons:
  - *Something breaks: detect it, react, in time*: the lidar fails 30 s into the busy floor's mission, the beacons go
    dark, a motor weakens. The health lights notice the lidar in half a second, but the first person is struck 21 s
    later because nothing reacts; slowing down at 31 s prevents every strike, slowing down at 52 s prevents none. The
    weak motor is never noticed at all.
  - *Looking for the failures nobody wrote down*: a search over the busy floor's operating domain finds a contact in
    about two of every five generated warehouses, more when it refines around the worst; people who wait for the
    robot and then step out make it worse; the safety stop helps on most scenarios and hurts on a few.
- Tools → Safety: the operating domain as a sheet of ranges, a check of the level on screen against it, a search that
  samples generated warehouses from the sheet and refines around the worst runs, each run opened in the simulator with
  one button, and scenario sets kept from a search and rerun after you change something, saved and loaded as JSON.
- A fault schedule: any setting can change at a given second of a run (a sensor off, fog rolling in, a motor
  weakened), from a lesson, an experiment or a level file; the event log says when.
- People who wait for the robot: in a level file or the world generator, a person can stand still until the robot
  comes near, then walk.

## v60 · 2026-10-22

- A new Learn group, Safety: the ideas of the safety standards for automated vehicles and robots (ISO 26262,
  ISO 21448 or SOTIF, ISO/PAS 8800 and UL 4600), done on the simulator rather than read. The lab paraphrases the
  standards and quotes none of them. Three lessons to start:
  - *The operating domain*: write down where the busy floor's stack is meant to work, then test it inside and just
    outside, one boundary at a time, on generated warehouses: aisles of 1.2 m instead of 2 m bring rack contacts on
    every seed, eight people instead of four bring more contacts with people.
  - *Hazards and risk*: rate the busy floor and the parking lot by severity, exposure and controllability, every
    rating measured. Ignoring the people means three strikes above 1.3 m/s; people who step aside turn them into
    bumps; the speed planner leaves one bump but spends more time near people.
  - *Triggering conditions*: failures with nothing broken. A person turning back at the end of their walk, fog, the
    particle filter's bad seed, a person inside the sonar's dead zone; one fixed by the learned predictor, which then
    shows a failure of its own; and for each, whether the stack notices.
- Chapter 8, Safety, derives what the lessons use and tabulates the measured runs; Notation and references is now
  chapter 9.
- The Metrics list beside the event log has safety rows: each contact with its speed and a severity class of the lab's
  own (touch below 0.3 m/s, bump up to 1 m/s, strike above), the robot's closest approach to a rack or wall, the
  seconds closer than 0.3 m to a person, the time to contact, and the time spent near people or reversing. Experiments
  can chart the impact speed, the wall clearance and the close-call seconds, and Runs compares the first two.

## v59 · 2026-10-22

- Lessons: in five lessons (velocity obstacles, the learned detector, the learned predictor, D* Lite and the
  end-to-end policy) the "Before you press" question under an experiment asked about the experiment after it. Each
  question now sits under the experiment it asks about, and the experiments left without one have a question of
  their own. D* Lite's periodic replan now says what the status strip shows: on a map that does not change,
  most of its replans have nothing to repair.

## v58 · 2026-10-20

- An ultrasonic ring: Perceive → Ultrasonic ring (off by default) puts 8 sonars round the robot, each a 30° cone that
  reports one number, the range of the nearest echo in the cone. It has a sonar's real failures: walls met at a slant
  send the echo away, anything closer than 0.2 m is lost in the dead zone, a sonar sometimes hears its neighbour, and
  the ring fires in turn, so each sonar reads only every 0.4 s. Sonars, beam width, reach, dead zone, noise, how
  oblique a surface may be, crosstalk and the ping time are all settings. The Sonar ring layer draws each cone and the
  arc it returned, and marks the misses.
- What the ring can be used for: building the map (Perceive → What builds the map: lidar, sonar ring or both), the
  safety stop (Control → The safety stop reads), and the particle filter against the prior map (Localize → Also weight
  particles by the sonar ring), so a sonar-only localizer can be tried. Your localizer and predictor in the Code tab
  receive the readings as obs.sonar.
- A new Perceive lesson, Sonar: one number for a whole cone, with nine experiments on the unknown building, the
  warehouse aisles, the busy floor and the noisy-odometry floor: the robot driving into a wall no sonar heard, the
  blurred map of rougher walls, a sonar safety stop that loses a person in its dead zone, and a particle filter that
  localizes on the sonars alone with about twice the lidar's error. Chapter 3 has a new section deriving the arc
  update and the cone likelihood, with the measured table. The lab models no materials, so the sonar's real strength,
  hearing glass and dark surfaces a lidar can miss, does not show here; the lesson says so.

- Localize → Sensors: one switch per sensor (wheel odometry, the yaw-rate gyro, the lidar, the beacons, GNSS, the ultrasonic ring and the radar),
  each with a line on what it gives the robot, and a row of dots beside the four health lights showing what the
  robot is sensing with (a click opens the switches). Turn any of them off and the rest of the stack carries on and
  says what it lost: with the lidar off there is no mapping, people detection, scan matching or lidar safety stop,
  and the planners use the map they have; with the beacons off the EKF coasts on odometry; with the wheel odometry
  off the filters predict with the commanded speed and turn rate; with every sensor of the world off the health
  lights say the robot is blind. Setup links and Try buttons can switch any sensor.
- GNSS, a new sensor (off by default; it belongs on the parking lot and the road, and works anywhere else as if the
  world had a sky): position fixes 1 to 5 times a second, about a metre off, with an error that wanders slowly over
  a minute, jumps of a few metres next to walls and parked cars (multipath), and outages. The fixes are drawn on the
  map: filled when the filter used them, crossed out when the gate rejected them. The EKF and the particle filter
  fuse them, your localizer in the Code tab receives them, and the EKF can estimate the receiver's bias as two more
  states. A filter rejecting every fix for 10 s restarts from them.
- Localization lesson 9, "GNSS: the noise is not white", on the parking lot: dead reckoning, GNSS alone, GNSS with
  odometry, the bias in the state, multipath along the parked cars and an outage, with the consistency plot under
  the error. Chapter 2 §12 derives the slowly wandering error, what it does to a Kalman filter that takes the fixes
  as independent, and the filter that carries the bias, with the measured table and what the model leaves out.

- A radar (Perceive → Radar): it looks ahead 120° and 20 m and reports, for each echo, the range, the bearing and
  how fast the thing closes or opens (its radial velocity, from the Doppler shift). The map draws each detection as a
  diamond with an arrow for that speed, false detections and ghosts (echoes that bounced off a wall) included, since
  the robot cannot tell them apart. The metrics show what it saw and the nearest echo ahead with its closing speed
  and time to contact.
- Perceive → Tracker inputs: the people tracker can update from the lidar, the radar, or both. With both, a person
  who turns around is followed within a scan or two instead of most of a second.
- Perceive → Weather: rain and fog shorten the lidar's reach, make it miss beams and see the air itself; the radar
  hardly notices.
- New lesson in Perceive, "Radar: speed from the echo", with six experiments (fusion, fog, clutter, and the moose
  test read by the radar), and a new section in chapter 3 on the radar's measurement model and what it is worse at.
- Your predictor in the Code tab receives the radar's detections as `obs.radar`.

## v57 · 2026-10-20

- Custom levels: the level menu has a new entry, Custom level. Import a level from a JSON file, export the one on
  screen as JSON (with what you painted and erased, and the goals you placed), copy a link that carries the level
  itself, and keep levels in this browser; kept levels appear in the menu after the seven built-in floors.
- Generate a level: rooms and corridors with doors, a warehouse of racks and aisles, or an open hall with pillars and
  boxes, from 8 × 6 m up to 48 × 32 m. Pick the size, the number of goals, people and beacons, a few settings of the
  family (room size and door width; aisle width, rack depth and cross aisles; how many obstacles and how far apart),
  whose settings it takes (L1–L5) and a seed; the same seed always gives the same level, and Next seed gives another.
  The goals are always ones the robot can reach. A large floor runs at full speed on the desktop; on a phone keep it
  smaller.
- Tools → Train: a source's map can be generated worlds (rooms, warehouses or halls, a new world every run), so you
  can collect training data on many different floors in one go, or the custom level on screen.
- Something to try: a 48 × 32 m generated warehouse with the busy floor's settings. With unlabeled beacons in rows of
  identical aisles the particle filter can lock onto the wrong aisle; switch Localize → Beacon association to Known
  IDs and it holds. (PR #114)

## v56 · 2026-10-20

- Plan → Learned policy: the policy now proposes four candidate paths with a score each instead of one, and the
  robot drives one that stays clear of the inflated obstacles, the best-scoring one, or the one closest to the path
  it is already driving unless another is much likelier; the others are drawn faint on the map (rose where they run
  into an obstacle). Before, where the demonstrations went either way around a shelf, the one path was the average of
  the two and went through the shelf. When no candidate is clear, the safety layer of version 55 takes over as
  before. Over five runs each, the building (L4) now has 4 collisions where it had 9, and the busy floor (L5) reaches
  21 of 25 goals with 1 collision where it reached 19 with 3; the aisles (L2) are about the same, 16 of 20 goals.
  The Plan tab also counts how often a lower-scored candidate was taken.
- Lesson "An end-to-end policy" and chapter 4 §10: new measurements, the mixture loss, and a sixth Try, the building
  with a subgoal.
- Tools → Train: the policy is trained with the same mixture loss, and the results show the error of the best of
  the four candidates next to the best-scoring one's. Policies trained in the page before this still run (as one
  candidate). (PR #112)

## v55 · 2026-10-20

- Lidar mapping with Perceive → Unknown space → Lethal: the planners can now plan through the space between the
  beams. The 120 beams are 3° apart, so beyond about 2 m they left unseen cells between them, each of which was
  inflated into an obstacle: the robot could plan only within about 3 m of where it had been, and now plans as far
  as the lidar sees, about 7 m. Those cells still count as unexplored for Explore and the floor seen, and with
  Unknown space → Free nothing changes.
- Lethal unknown space no longer stops the robot: a goal it has not seen, out of range or behind a wall, used to
  have no plan, so the robot never moved and every goal was skipped. Now the robot heads for the edge of the seen
  floor nearest the goal, replans every second as the map grows, and plans to the goal once it is on seen floor;
  the event log says when each happens. On the unknown building it takes all four goals, more slowly than with
  Free (83 s against 67 s).
- A robot stuck against an obstacle now backs off to clear floor before it replans. Before, the new plan started
  right at the obstacle and the robot pushed back into it until the goal was given up. (Not for the car, Straight
  line or the learned policy, which would drive back into it.)
- Plan → Learned policy: the safety layer now checks the lines between the waypoints as well as the waypoints,
  keeps the path 10 cm clear of the inflated obstacles, and reroutes a line that comes too close with a short A*
  detour. When the robot is pinned against an obstacle and the policy keeps pushing into it, the robot follows
  1.5 m of the A* route instead, and the policy takes over again from there. The Plan tab counts each of these.
  On the warehouse aisles the policy now reaches 3 of 4 goals, where it reached none; pointed at the subgoal, it
  takes all four goals on the aisles and in the building, with no collision. (PR #111)

## v54 · 2026-10-20

- Perceive: with agent tracking off, a note now says that people prediction (including the learned predictor) is
  set there once tracking is on, names the levels with people, and has a button that turns lidar tracking on.
- Plan → Learned policy: the description now lists what still runs while the policy drives, for the settings in
  use: the estimator that places the goal and the waypoints, the costmap that keeps the waypoints out of obstacles,
  how the controller reacts to people, the controller that follows the path, and the mission logic. Before, it said
  "no map, no search", which left that unclear. (PR #109)

## v53 · 2026-10-20

- Comparing runs: the "Previous run" chip at the bottom right of the map now has Pin. A pinned run keeps its path on
  the map (amber, dashed) and its series in the plots through Reset, new settings and Try buttons on the same level,
  so a run can be compared with several others; Unpin, or Runs, ends it. Before, the previous run was replaced at
  every Reset, so it was only ever the last one.
- Lessons no longer switch off the previous run's path: after a Try, the run before it stays on the map to compare
  with (Layers → Previous run still hides it). (PR #107)

## v52 · 2026-10-20

- A learned people predictor: Perceive → Prediction → Learned (network). For each tracked person it draws three
  possible paths for the next 3 s with a probability each (bold: likely), next to constant velocity as a grey dashed
  line, and the speed planner, space-time A*, DWA and MPC plan against the most probable one, or, with Plan against →
  Every future ≥ 20 %, against all the likely ones. Where people pause or reach the end of their walk, the paths
  split.
- The metrics now show the prediction error at 1 s and 2 s of both predictors, against where the people really
  went, whichever one is driving; with the learned one on, the status strip shows the two at 2 s.
- Perceive lesson 8 compares the two on scripted and reacting people, and shows where the network is worse than
  constant velocity (perfect tracks) and what planning against every likely future costs; chapter 3 §10 derives the
  training loss and has the measured tables. In short: the learned paths are closer to the truth on every seed,
  but the robot touches people about as often.
- Tools → Train can retrain the predictor: collect runs on the levels with people, train, compare with the built-in
  model on a run it has not seen, save, and pick it under Perceive → Predictor model.
- The page is about 0.7 MB lighter: the learned models were included twice. (PRs #105, #106)

## v51 · 2026-10-20

- The learned people detector (Perceive → Agent tracking → Learned detector) now also weighs how well the map
  explains each lidar hit, alongside the shape and motion of the hits, and was retrained on runs where the map is
  right, still being built, or misplaced by a drifting pose. It no longer sees phantom people on walls: with a
  good map it matches the classical detector, and where the classical one fails it keeps working. On the busy floor,
  while the map is being built, or with the pose drifting on dead reckoning, the classical detector carries a dozen
  or more phantom tracks and the learned one about one; precision is ten times higher.
- Lesson 7 of Perceive is rewritten around those cases, with new experiments for a drifting pose and for a particle
  filter that slips on its own (seed 12), and chapter 3 §9 has the measured table. Detector models you trained
  earlier in Tools → Train still run; models trained now use the map too.
- Detection precision and recall in the lessons are now scored in the robot's own frame, so a wrong pose estimate
  is not counted against a detector. (PR #104)

## v50 · 2026-10-18

- Nothing changes in the page. Behind it, the demo deploy to GitHub Pages waits until Pages is turned on, instead of
  reporting a failure on every update. (PR #103)

## v49 · 2026-10-18

- What's new: the version label in the header opens this log. Hover over it, or tap it on a phone, to see what
  changed in the current version and in the ones before it; versions released since your last visit are marked new,
  and the label carries a dot until you have looked.
- The log has entries again for v41 to v44, which were missing. (PR #102)

## v48 · 2026-10-18

- The "How it works" panels on the Simulate tabs show their formulas typeset, as the lessons do, and so do the two
  formulas in Analyze's derivations. Mission's state machine is now a list of transitions.
- Equations written one under another line up on their = signs, in lessons, chapters and panels (they were centred).
  (PR #101)

## v47 · 2026-10-18

- Lesson math is typeset: matrices, fractions, subscripts and aligned equations instead of plain text such as
  `G = [1 0 −vΔt sin θ; …]`, in all 41 lessons.
- Every lesson experiment was rerun and its text checked against what the simulator does, at the button's seed and at
  other seeds wherever a prediction compares two runs. Numbers that no longer matched are corrected. Predictions whose
  answer changed with the seed, or that relied on a figure the page does not show, now ask about something you can see
  and that holds on every run. In Localization 6 and 8 and Control 18 each prediction had asked about the next
  experiment; they are now with the right one. Dead reckoning's "Noise ×3" asks what reliably triples (the 2σ band):
  the error itself was between 2 and 9 times the ×1 run's, depending on when you looked.
- Analyze's what-if caption says "would turn" and "would steer" (it said "would turns"). (PR #100)

## v46 · 2026-10-18

- The level menu scrolls: on L3 to L7 the last quick experiments were cut off.
- Reset all progress (Learn) works in the published page: it now asks for a second click instead of a confirmation box,
  which the page's frame blocked. (PR #99)

## v45 · 2026-10-17

- Training in the page (Tools → Train): retrain the people detector or the end-to-end policy yourself. Collect data
  from runs on the levels, the map on screen, saved maps or random obstacles; pick a network size; train in the browser;
  compare the result with the built-in model on a run it did not see. Trained models stay in this browser, can be
  picked in Perceive → Detector model and Plan → Policy model, and can be saved and loaded as files.
- Changing level keeps the settings you changed (except map edits, beacons switched off, and a planner or tracker the
  new vehicle cannot use). Try buttons, lessons and links still start from the level's own setup.
- Control → Real-time budget per solve sets how long MPC may think each step (15 ms by default; 0 for no limit).
  (PR #97)

## v44 · 2026-10-17

The UI review, in six steps (PRs #91–#96):

- Tokens and components: retuned neutrals in both themes, seven type sizes, two radii, three control heights, and a
  quiet selection (a segmented control is a grey groove, the chosen option raised).
- One level button in the header, "L5 · Busy floor ▾", whose menu lists the floors and the current floor's quick
  experiments; Changed, Runs and View are ghost buttons.
- One status row: the mission state as a small pill with a coloured dot, the four subsystems as a dot and a name each
  (the reason in the tooltip, a click for every check).
- The map's tools as a rail on its left edge, zoom and follow in one cluster, a quieter floor palette.
- One telemetry toolbar (channel, Compare and a "⋯" menu with + Plot, Whole run, CSV and PNG) and frameless plots.
- One inspector tab row with More ▾; in Learn a reading column (16 px text, 70 characters a line) with each
  experiment as a card; on phones the map edge to edge, the tools folded, and a bottom bar.

## v43 · 2026-10-17

- Every lesson checked against the simulator: all 41 lessons, the levels' quick experiments and the chapter sentences
  that quote them replayed at seed 7, and text, numbers and predictions corrected where they disagreed.
- Hybrid A* honours Allow reversing in its final analytic shot (L6 "No reversing" reversed into the bay anyway); the
  turn-rate message and the step menu fixed. (PR #90)

## v42 · 2026-10-17

- Lessons on the empty floor where the obstacles only got in the way: localization 6 (A gyro in the loop) runs lesson
  1's lap, control 14 (When the wheels don't go where they point) L1's goals with no box in the way. (PR #89)

## v41 · 2026-10-17

- Lesson progress you can read: a key to what fills the circle in front of each lesson, a strip under an open lesson
  with a ✓ per experiment and for Check yourself, Reset for one lesson and Reset all progress. (PR #87)
- An editable map: Map → Empty floor (only the outer walls), Paint and Erase obstacles on the map toolbar, and Repeat the
  goals on the Mission tab; the map is a setting, so links, Copy setup and Try buttons carry it. Lesson 1 laps the empty
  floor. (PR #88)

## v40 · 2026-10-16

Phase 4, the learning tracks, first blocks:

- An end-to-end policy (Plan → Learned policy): a multilayer perceptron (139 → 256 → 256 → 16, 105 744 parameters,
  665 KB inlined) from the scan with sector minima, the odometry and the goal in the robot frame to eight waypoints
  along the route, run as a planner the tracker follows, replanned every 0.5 s, with a safety layer that moves a
  waypoint out of an inflated obstacle; a subgoal mode points it 3 m along the A* route. Trained by behaviour cloning
  (`tools/collect-policy.mjs`: random goals, actuation noise on the expert's commands, A* labels; DAgger rounds with
  the policy driving; `training/policy/train.py`). Measured and told plainly in planning lesson 8 and chapter 4 §10:
  all goals on the open floor, four of five on the busy floor it never saw, a collision at the first shelf corner of
  the aisles and the building's doors beyond it, through noise injection, DAgger and the subgoal. `actNoise` on the
  vehicle for the collectors, `setGoals` for goal lists, a Node test of the perceptron.

- A learned people detector (Perceive → Agent tracking → Learned detector + Kalman): a 1D convolutional network over the
  120 beams (circular padding, 8 017 parameters, 66 KB inlined) that labels each beam "person" or "static" from six
  features, among them the previous scan reprojected through the odometry so that the robot's own motion is taken out;
  beams above 0.6 are clustered as the rule's unexplained hits are and handed to the tracker. Trained in PyTorch
  (`training/detector/train.py`) on 19 200 scans collected by `tools/collect-detector.mjs` over the headless core;
  the forward pass runs in `src/core/nn.js` with no dependency. The lidar layer colours hits by the probability.
  Measured on L5: precision 0.66 under lidar mapping against 0.07 for the rule without a settled map; 0.73 against
  the rule's 0.92 with a prior map. Per-target scan matching (Perceive → Agent tracking) aligns a track's hits from one
  scan to the next by ICP and fuses the displacement as a velocity measurement (0.40 to 0.25 m/s RMS). Perception
  lesson 7, chapter 3 §9, `tests/measure_det.py`, a Node test of the forward pass, `training/README.md`.

## v39 · 2026-10-16

- Velocity obstacles (Control → Response to agents → Velocity obstacles, for the path trackers): one cone per tracked
  person (the ray-disc quadratic within a horizon τ), the tracker's command tested against them and, when inside,
  replaced by the nearest of 76 sampled velocities outside all cones (speeds down to a quarter, headings to 90°, a
  slow reverse), realized as a speed and a turn; stop when none is free. A Velocity obstacles map layer (the cones in
  world coordinates scaled by τ, the command and the chosen velocity), horizon and clearance sliders, a Control info
  line with the interventions and stops. Perception lesson 6, *Velocity obstacles: steering around people in velocity
  space*, five measured experiments on the busy floor (scripted people who walk through the robot, reacting people,
  the shelf the cones do not know), chapter 4 §9.
- D* Lite (Plan → D* Lite, `core/planning-dstar.js`): the grid search kept between plans, run from the goal, with g and
  rhs per cell, the two-part key packed into one number, k_m for the robot's motion, a costmap diff (lethal flips and
  penalty moves over 0.1) that repairs only the touched vertices; the same cost model as A*, so the same paths; the
  search is dropped when the goal, the planner or ε changes. Each plan logs its vertex updates and the cells changed;
  the mission keeps plan totals (count, expansions, ms). Planning lesson 7, *D* Lite: repairing the plan instead of
  starting over*, five measured experiments with the honest reading (six-fold fewer expansions on a static map with a
  periodic replan, more work than A* when lidar mapping or agent stamps change thousands of cells), chapter 4 §8.
- Pose-graph SLAM (Localize → Pose-graph SLAM, lidar only): keyframes every 0.5 m with their scans, each first aligned
  to the hit map of the earlier keyframes and fused with the odometry (the edge carries the matched motion), loop
  closures by scan-to-scan ICP against keyframes at least ten back within a reach that grows with the uncertainty,
  Gauss–Newton over all poses with the first fixed (dense Cholesky, one optimization per second), the current pose's
  covariance from the marginal, the hit map and the planning grid rebuilt from every kept scan at the new poses. A
  Pose graph layer, a Localize info line, the "Loop closures" and "Map agreement" signals, switches for the two levels
  and the keyframe spacing, `goals` in a Try cfg (the mission restarts on them). Localization lesson 8, *Pose-graph
  SLAM: the map that closes the loop*, six experiments on an out-and-back tour of L4 (with the honest finding that
  scan-to-map matching does most of the work and closures need a gyro-grade odometry to be found), chapter 2 §11,
  Node tests for the pose algebra, ICP and the optimizer.

## v38 · 2026-10-16

- Scan matching (Localize → Lidar scan matching, with the EKF and a prior map): every fourth tick the scan is aligned
  to the map's distance field by Gauss–Newton from the current estimate and fused as a pose measurement with the
  covariance of the fit (inflated, floored at 5 cm), gated, fused only after the robot has moved, dropped when the fit
  is poor. The lidar becomes a position sensor: 4 cm RMS on L3 with every beacon off. A Localize info line reports
  each match; Signals has the residual; `bOff: "all"` in a Try switches every beacon off. Localization lesson 7, *Scan
  matching: the lidar as a position sensor*, five measured experiments including the kidnap that scan matching cannot
  see (perceptual aliasing), chapter 2 §10, the loc slot gets the map's distance field once (`obs.field`) and a
  scan-matching example.
- The code behind every lesson. Each of the 35 lessons shows the page's own function for what it teaches (cut from the
  page's source at runtime by `// @code` markers, so it cannot drift), with the lesson's lines marked, a note on what to
  look at and change, and "Edit and run", which puts a plain slot version of the algorithm into the Code tab as "Your
  code" on the lesson's level. Twelve slot examples (`src/examples/`): dead reckoning, EKF, particle filter; A*,
  Dijkstra, RRT*; pure pursuit, Stanley, PID, rear-wheel feedback; constant velocity, standing still. The Code tab gets
  an examples menu and a "How this fits in" panel per slot (where it runs in the tick, what it gets and returns, what
  happens when it fails); the "Your code" choice in Localize, Plan, Control and Perceive explains itself with a button
  into the Code tab. `tests/extest.py` runs every example against its built-in.

## v37 · 2026-10-16

Phase 4, content (from the assessment of 2026-10-15 and the owner's direction):

- A yaw-rate gyro for every vehicle (Vehicle → Yaw-rate gyro): the turn rate comes from the gyro instead of the
  wheels, with its own noise σ and a bias the filter is not told, and a zero-velocity update that holds the robot
  still for 2 s at the start of a run, averages the gyro into a bias estimate and subtracts it. The filters' assumed
  turn-rate noise follows. Lesson 6 of the localization group, *A gyro in the loop: heading is the expensive error*,
  with six measured experiments, and chapter 2 §9 with the random walk, the bias integrals and the update.
- Analyze: a design row under the pole plot. Pole placement by damping and natural frequency, and LQR from three
  weights with the closed-form gains, both shown as a what-if where the pair really lands with the delays in the
  loop; a lesson Try can ask for either (`place`, `lqr`). Control lesson 18, *Placing the poles on purpose: pole
  placement and LQR*, and chapter 6 §8 with the Riccati equation solved in closed form.
- Frontier exploration (Mission → Goal order → Explore) on any level with lidar mapping: the robot picks its own goals,
  the largest nearby frontier (known free next to unknown, at least N cells), drops a goal once nothing behind it is
  unknown any more, retries the ones that failed once nothing else is left, and stops when the map has no frontier.
  A Frontiers layer, a "Floor seen" signal and status metric, L4 gets an Explore button. Lesson 6 of the planning
  group, *Frontier exploration: the robot picks its own goals*, with five measured experiments, and chapter 4 §7.

## v36 · 2026-10-16

Phase 3, code health (from the assessment of 2026-10-15):

- `npm run lint`: ESLint with the shared scope's names generated from the manifest, so a misspelled cross-module
  reference fails statically instead of at runtime on that path; CI runs it. ESLint is a dev dependency only
  (`npm install`); the build and the page still need nothing.
- The source is formatted with Prettier at 140 columns (`npm run fmt`, checked in CI); one reformat commit, listed
  in `.git-blame-ignore-revs`. The lines go from 6,277 to 19,610 with no change in behaviour (the golden tests and
  the browser gate are identical).
- The three biggest functions are split: `draw` (477 lines) into eighteen layer functions in drawing order, `ctlMPC`
  (349) into the controller plus six helpers (agent predictions, agent constraints, warm start, linearization,
  rollout, the constraint set) with explicit parameters, `renderAnalysis` into the view plus four section helpers.
  The lint found the two locals the first cuts had missed. Every remaining function over 100 lines has a header
  that says what it does.
- Fix: switching to DWA (or your code) while the step test was playing threw in the response plot's playback; the
  playback now stops when the tracker has no linear model.
- `setParam` validates: a choice parameter must be one of its values (`PARAM_OPTS` in `core/params.js`) and a numeric
  one a finite number; anything else is ignored with a log line instead of falling into a default branch (a mistyped
  setup link `plan=foo` used to run RRT*). Its if-chain of side effects is an ordered table, `PARAM_EFFECTS`.
- Unit tests for the closed-form numerics (`tests/node/numerics.test.mjs`, in `npm test`): the 3 × 3 inverse, the
  Cholesky solve, the box QP, the distance transform, Reeds–Shepp lengths and samples, A* on a free line and round
  obstacles, and the textbook properties of one EKF update. The worker exposes them to Node as `self.__core`.
- `ui/st-plot.js` moves after the core in the manifest, so the core/ui split in the concatenation order is exact.
  Running the live simulation in the worker was assessed and deferred (a week of its own; `docs/roadmap.md`).

## v35 · 2026-10-16

Phase 2, workspace polish (from the assessment of 2026-10-15):

- The preset plot follows the level until you pick one: cross-track where the pose is known (L1, L2, L6, L7),
  position error where there is an estimate to judge. With ground truth the status strip says "pose known" and the
  metrics show one line instead of a zero pose error, a zero RMS and an empty NEES.
- Phone: the level selector is a row again (the app bar's 380 px flex basis had become its height), the world is
  fitted left of the view buttons so the east wall's beacons can be tapped, and in the stacked layouts a plain wheel
  scrolls the page past the map while Ctrl or ⌘ + wheel (a pinch) zooms it.
- The address bar always says what the page shows: the setup link in Simulate (`#l=L3&seed=7&loc=ekf…`), with
  `mode=an` in Analyze and `t=12.3` while a recorded moment is replayed; `#learn`, `#lesson=…` or `#notes=…` in
  Learn. A pasted link applies while the page is open, and a link with `t=` runs the setup to that moment and shows
  it paused (`ui/urlstate.js`).
- The event log has a search box (matching lines are marked on the timeline), a severity filter (All, Warnings,
  Errors), an order toggle (oldest first) and follows the replayed moment.
- The recording plays: ▶ next to the timeline (or P) plays it at the speed setting from the shown moment; I and O
  set a loop region's in and out points (handles on the track drag them, × clears), playback wraps inside it, and
  "Whole run" in the plots and the CSV export are trimmed to it.
- A health light is the worst of its subsystem's checks; a click opens the list: every check with its state, the
  subsystem's recent events (a click seeks the timeline) and the button to its tab.
- Settings applied from a link re-render the tabs at once (the Localize tab could still show the level's default
  estimator while the link's one ran).
- Experiments land in the workspace: the runs' paths are drawn on the map (a layer, coloured by configuration);
  when one numeric parameter is varied the chart is the metric against its value, a dot per run with the mean as a
  line; hovering a dot (or a bar) makes that run's path bold on the map and names it, and a click runs that setup
  live with its seed.
- The telemetry dock takes the height that leaves the map at the world's 3:2 aspect (between 150 and 320 px) until
  the splitter is dragged, so the map no longer sits letterboxed between empty margins on the wide layout.
- The Code tab's editor highlights comments, strings, numbers, keywords and the slot API's names, tints the line an
  error names, shows the line count, and says what the sandbox allows.

## v34 · 2026-10-16

Phase 1, the learning path (from the assessment of 2026-10-15):

- Learn opens with a "Start here" card: who the lessons are for, what they assume, how lessons, chapters, levels and
  the Symbols tab relate, and a first pass of eight lessons with a reading time each (`src/ui/path.js`).
- Opening a lesson sets the stage up as its first experiment would, without running it: the simulator on the
  lesson's level with its settings, tab and plot, or the Analyze view for a control lesson (`hold` in `tryGo`).
  Back from a chapter and the Try buttons leave the stage as it is.
- Predict first: an experiment can carry a question with three answers, asked before its button; "What you will
  see" stays folded until the learner has picked one, then the pick and the measured answer are marked. Every lesson
  ends with a numeric self-check (type a number, Check; the working appears after a second miss). Picks and passed
  checks are remembered in this browser.
- Progress: a dot per lesson (started, done), a bar per group and a count above the list, ticks on the first pass,
  "Continue with lesson n" on the Start here card; Next follows the first pass while the open lesson is on it.
- The level panel's Try list is now "Quick experiments", with a line that names the lessons whose experiments run
  on this floor (a click opens the lesson), so the two experiment systems stop competing.
- Chapter 8, Notation and references: the conventions (frames, truth and estimate, the three noise covariances M,
  Q and R, bearing b), the letters that mean two things, one symbol table by area, and the sixteen references the
  material draws on. Control lesson 1 names its chips in one line each before the later lessons use them; the
  longest sentences of chapters 1 and 6 are split.
- The lessons move out of JavaScript: `docs/lessons/<group>/*.md`, one file per lesson, read by `tools/lessons.mjs`
  at build time and inlined as `LESSON_DATA`; the lesson objects the page sees are byte-identical (round-tripped).
  A content contributor never opens a `.js` file for a lesson now; the terms list stays in `glossary.js`.

## v33 · 2026-10-16

README rewritten in plain language; the module map and the lesson/chapter format move to `src/README.md`; the
learning tracks (classical, modular learning, end-to-end) join Phase 4 of the assessment and the roadmap (PR #54).

## v32 · 2026-10-16

Release series (open-source readiness, from the assessment of 2026-10-15):

- The built page is a complete standalone HTML document (doctype, charset, viewport, `lang`, CSP); it renders from
  any static host, not only inside the claude.ai artifact. `tests/wrap.py` is gone.
- The four typefaces are embedded (`src/fonts/`, SIL OFL); the page makes no network request at runtime.
- A public README with the GitHub Pages demo; maintainer rules in `docs/maintaining.md`.
- Portable tests (`tests/_browser.py`, `tests/run_all.py`, `package.json`); Node golden tests over
  `dist/core-worker.js` with a committed baseline (`tests/node/golden.json`); GitHub Actions for CI, the nightly
  browser gate and the Pages deploy.
- Lessons: the seed is pinned when a Try names a level, the order-dependent control Trys are self-contained, two
  numeric slips fixed, one notation (Q measurement, M odometry, R process noise, b bearing), the PID row and the
  kinematic sideslip number corrected.
- Accessibility: light-mode amber darkened and the dimmed log lines and tab numbers made readable (WCAG AA), group
  labels on the status strip and the transport bar.
- Removed from the tree: `legacy/` (the v1–v7 patch scripts; in the history up to this commit) and
  `docs/screenshots/` (40 MB of phase screenshots; kept on the `archive/screenshots` branch).

## v31 · 2026-10-16

L7, the moose test: a road with a box in the lane for the car with tyre slip; the MPC with the tyre model in its
prediction (`mpcDyn`); a lidar safety stop (PR #42).

## v30 · 2026-10-15

v29 feedback: sensor settings on Localize and Perceive, the previous run on every tab, Analyze lateral derivations
with the step test played back, Analyze legends, the planner's search step by step (PRs #38–#41).

## v29 · 2026-10-15

Car with tyre slip: a third vehicle (dynamic bicycle model, linear tyres with a friction limit) with Grippy and
Slippery floor presets, sideslip on the map, slip signals and a grip-limit health light, Analyze with the tyres in the
plant, three control lessons, chapter 1 with the lab's car (PRs #33–#37).

Earlier versions: see `docs/roadmap.md` (phases 6 and 7, the enhancement plan v8–v13) and the git history.
