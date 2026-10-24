id: ch8
num: 8
sys: saf
summary: The ideas behind the Safety lessons: the four standards in the lab's own words, the operating domain as a set of conditions, hazard analysis with the lab's severity scale and measured exposure, the safety measures the simulator keeps, triggering conditions, faults and their time budget, searching the domain for failures, the learned blocks measured by slice and watched for inputs outside their data, mitigations with their price, and rates per hour with their intervals and leading indicators.

# Safety: domains, hazards, faults and search

The other chapters ask how each block of the stack works and how it fails. This one asks what a safety engineer asks of the whole: where the stack may be used, which of its failures can hurt someone and how badly, and what makes a stack with nothing broken fail anyway. The vocabulary comes from four standards; the method, on this page, is measurement. Everything here paraphrases the standards and quotes none of them. The clause numbers are the best available from public outlines of the editions named below and have not been checked against the texts.

## 1. The four standards, in the lab's words

**ISO 26262 (2018), functional safety.** Risk from *malfunction*: a part of an electrical or electronic system fails, and the design must detect the failure and reach a safe state before harm can follow. Its concept phase defines the *item* (the system, its functions, its boundary; part 3, clause 5) and analyses the hazards its malfunctions could cause (part 3, clause 6), giving each an integrity level that sets how rigorous the rest of the development must be. In the lab: a sensor switched off on the Sensors switchboard, a bias the filters are not told about, a beacon outage, a kidnap.

**ISO 21448 (2022), safety of the intended functionality (SOTIF).** Risk with *nothing broken*: the specified function, or the sensors and algorithms that implement it, is not good enough for some situations. Those gaps are *functional insufficiencies*; the conditions that expose them are *triggering conditions* (clause 7). The standard runs from hazards (clause 6) through changes to the function (clause 8), the verification and validation strategy (clause 9) and the evaluation of known and unknown scenarios (clauses 10 and 11) to a judgement of what is left (clause 12). In the lab: fog shortening the lidar, a person turning back at the end of their walk, a sonar that cannot hear inside 0.2 m.

**ISO/PAS 8800 (2024), safety and artificial intelligence.** The same two questions for components that are learned rather than written: what the data must cover (clause 11), how a model is verified (clause 12), how its errors are analysed (clause 13), how it is watched in use (clause 14), and the assurance argument that ties them together (clause 8). In the lab: the learned people detector, the learned predictor and the end-to-end policy.

**ANSI/UL 4600 (third edition, 2023), safety of autonomous products.** A product with no human driver needs a *safety case*: claims, the arguments that connect them, and evidence for each, covering the operating domain, the hazards, every autonomy function and the testing (clause 5, with the hazards in clause 6 and the autonomy functions in clause 8), kept up to date by *safety performance indicators* measured in operation (clause 16).

The item in these lessons is always the same: the navigation stack as configured, driving a mission in a level. The lab's robots are a warehouse robot and small cars; the standards are written for road vehicles and autonomous products. The page uses them as a vocabulary and a method, not as a claim that anything here complies with them.

## 2. The operating domain

**A set of conditions.** An operating domain (ODD, operational design domain) lists the conditions a system is designed to work in. Write each condition as an attribute $x_i$ of the world, the mission or the robot, with a set $A_i$ of allowed values; the domain is every combination inside all of them:
$$
\mathcal{D} = \{\, x : x_i \in A_i \ \text{for every attribute } i \,\}.
$$
A level is inside when every attribute is. The sheet for the busy floor, ODD-1:

| Attribute | Allowed | Where the lab sets it |
| --- | --- | --- |
| layout | warehouse rows, aisles at least 2 m | the level; the generator's `aisle` |
| people | at most 4, walking 0.5–0.9 m/s, scripted | the level's people; the generator's `people` |
| weather | clear | Perceive → weather |
| beacons | about one per 32 m², unlabeled | the level; the generator's `beacons` |
| GNSS | none (indoors) | Sensors |
| robot | unicycle, cruise 0.8 m/s | Vehicle, Control |

**What a domain is for.** Three things. It bounds the claims: "safe enough" is said about $\mathcal{D}$, not about the world. It says what the testing must cover: a sample of worlds from inside $\mathcal{D}$, not one level. And it is a boundary the system should notice crossing. The generator's parameters are attributes of exactly this kind, which is why the lessons sample generated warehouses: the same family and seed with one attribute moved across the boundary isolates that attribute.

**Measured** on the generated warehouse with seed 2 (24 × 16 m, L5's settings: particle filter with unlabeled beacons, the speed planner, lidar tracking), run seed 7 and, in brackets, the range over run seeds 1–5, counted up to Mission complete:

| World | Goals, time | Rack contacts | Person contacts | Wall clearance | Under 0.3 m of a person |
| --- | --- | --- | --- | --- | --- |
| inside: aisles 2 m, 4 people | 5/5, 102 s | 0 (0–1) | 1 (1–2) | 0.24 m | 2.5 s (1.8–5.4) |
| aisles 1.2 m | 5/5, 147 s | 2 (3–5) | 4 (3–5) | 0.08 m | 9.2 s (5.4–10.0) |
| 8 people | 5/5, 124 s | 1 (0–1) | 3 (2–8) | 0.04 m | 8.6 s (3.7–15.6) |
| fog | 5/5, 101 s | 0 (0–1) | 3 (1–4) | 0.22 m | 13.1 s (1.8–9.8) |

Two of the narrow-aisle runs did not finish in 300 s. The person contacts counted here include a person walking into the stopped robot.

**Margins.** The narrow aisles show where a boundary comes from. The robot is 0.6 m across, so a 1.2 m aisle leaves $m = (1.2 - 0.6)/2 = 0.3$ m a side when it is perfectly centred. Every error eats into that: the position error $e_p$ of the particle filter, the tracker's cross-track error $e_c$, the turn into the aisle. The robot touches the rack once $e_p + e_c > m$. In 2 m aisles $m = 0.7$ m, more than the errors of this stack; in 1.2 m aisles it is less. The costmap knows this too: its inflation band reaches 0.6 m from each rack, the whole width of a 1.2 m aisle, and on this world the planner reports that it found no path at 23 s, the one place where the stack itself notices the boundary.

**Observability.** Some attributes the robot can measure while it drives: the aisle width from its map, the people from its tracks, the beacons from their silence, the fog from how few lidar beams return. Some it cannot: the floor's grip, until a wheel slips. For the first kind a monitor can stop or slow the robot at the boundary; for the second the domain has to be enforced by whoever puts the robot to work.

## 3. Hazard analysis and risk assessment

**From situations to hazardous events.** A *hazard* is something the robot can do that could hurt someone: drive into a person, drive into a rack, stop where a person walks into it. A *hazardous event* is a hazard in an *operational situation*: driving down an aisle while a person walks it, reversing out of a parking bay with people in the lane. The analysis lists the situations, the hazards in each, and rates each pair on three scales.

**Severity, the lab's scale.** The standards rate severity by the injuries that are likely. The lab has no injuries, so it rates the relative speed at contact,
$$
v_{rel} = \lVert \mathbf v_r - \mathbf v_p \rVert,
$$
the robot's true velocity minus the person's (zero for a rack), in three classes of its own: *touch* below 0.3 m/s, *bump* from 0.3 to 1 m/s, *strike* above 1 m/s. The simulator records every contact with its $v_{rel}$ and class (Metrics → Contacts by speed). This scale is the lab's, not any standard's.

**Exposure, measured.** How often the situation occurs: the share of operating time $T_{op}$ (the time the mission runs) spent in it,
$$
E_s = \frac{T_s}{T_{op}}.
$$
The lab counts $T_s$ for having a person within 2 m (Metrics → Person within 2 m) and for reversing. Exposure is a property of the domain and the mission, and of the behaviour: the speed planner waits near people, so it spends more time near them than a robot that ignores them.

**Controllability.** Whether the people involved can avoid the harm. With no driver, it is the person in the aisle: scripted people never step aside, reacting people (Vehicle → People → Reactive) do. The difference between the two on the same seeds is the measured share of harm the people avert themselves. Most analyses of driverless systems take no credit for it, because a person who is looking at a phone, or carrying a box, does not step aside.

**The integrity level.** ISO 26262 (part 3, 6.4.3 and 6.4.4) combines the three classes, severity in four steps (0 to 3), exposure in five (0 to 4) and controllability in four (0 to 3), into an integrity level from QM (ordinary quality management) through A to D. Its determination table has a simple regularity, which is how the lab states it without reproducing the table: with every class at least 1, the level is D for the sum $s + e + c = 10$ (the worst class on all three scales), C for 9, B for 8, A for 7, and QM below; a class of 0 on any scale gives QM. Each step down in any one scale lowers the level by one step.

**Safety goals.** Every hazardous event that earns an integrity level gets a safety goal: a top-level requirement, stated in terms that can be checked. The lab's, for the busy floor: *no contact with a person above 0.3 m/s relative speed while the robot drives*, that is, nothing above a touch.

**Measured** on L5, the busy floor, at seed 7, up to Mission complete; in brackets seeds 2–5:

| Response to people | People | Contacts, speed and class | Person within 2 m | Mission |
| --- | --- | --- | --- | --- |
| ignore | scripted | 3 strikes: 1.36, 1.40, 1.60 m/s (the same) | 18.5 of 106 s | 5/5 |
| ignore | reacting | 2 bumps: 0.61, 0.87 m/s (2–3 bumps, 0.56–0.91) | 20.9 of 107 s | 5/5 |
| speed planner | scripted | 1 bump: 0.73 m/s (1, 0.71–1.12) | 33.4 of 121 s | 5/5 |
| speed planner | reacting | none (none; a rack contact on 2 of 4) | 37.0 of 122 s | 5/5 |
| MPC with predictions | scripted | 1 bump: 0.65 m/s (0–1) | 25.6 of 129 s | 5/5 |

And L6, the parking lot, at seed 7: no contact, reversing for 31.1 of 148 s (30–39 s on seeds 2–5) and a person within 2 m for 57.6 s. Only one row meets the safety goal on every seed, and it takes credit for the people stepping aside.

## 4. The safety measures the simulator keeps

None of these changes what the robot does, and none draws a random number, so the runs and the regression are the same with or without them. They are kept from the moment the mission starts; the time-based ones stop counting at Mission complete.

**Contacts by speed.** At the first tick of each contact the simulator records the time, the place, the kind (rack or person, and whether the robot was standing still), $v_{rel}$, its class, and the settings that differ from the defaults: the weather, a sensor switched off, the odometry bias and the like. For a rack $v_{rel}$ is the robot's speed just before the contact.

**Wall clearance.** The smallest gap between the true footprint and a static obstacle,
$$
g_{obs} = \min_t \min_k \bigl( D(\mathbf c_k(t)) - r_k \bigr),
$$
where $D$ is the distance field of the true occupancy (0.1 m cells, the same field the costmap's inflation uses) and $(\mathbf c_k, r_k)$ are the footprint's covering circles: one for the unicycle, three for the car, which overstate its corners by up to about 0.14 m, so a car's clearance can read slightly negative with no contact.

**Time to contact.** For each person at relative position $\mathbf d$ with body gap $g > 0$, the closing speed along the line between them and the time it would take to close the gap if both kept their velocities:
$$
\dot d_{close} = -\frac{\mathbf d \cdot (\mathbf v_p - \mathbf v_r)}{\lVert \mathbf d \rVert}, \qquad \tau = \frac{g}{\dot d_{close}} \quad (\dot d_{close} > 0.05 \text{ m/s}).
$$
The Metrics list shows the least $\tau$ of the run and the seconds with $\tau < 1$ s.

**Leading indicators.** A contact is a *lagging* indicator: by the time it counts, the harm has happened. The seconds closer than 0.3 m to a person, the seconds with $\tau < 1$ s, and the seconds the safety stop spent capping the speed move before a contact does and far more often, which is what makes them useful to watch; whether a given one actually predicts contacts is a measurement, made in a later lesson.

## 5. Triggering conditions and functional insufficiencies

**Two kinds of failure.** A *fault* is something broken: a sensor switched off, a bias the filters are not told about. A *functional insufficiency* is something not good enough with nothing broken: a predictor that assumes people keep walking, a lidar that sees 4 m in fog, a sonar deaf inside 0.2 m. A *triggering condition* is the situation that exposes an insufficiency: a person turning back beside the robot, fog, a person very close. ISO 26262 deals with the first kind; ISO 21448 with the second.

**The four areas.** (ISO 21448, its introduction and clause 4.) Sort the situations a system meets two ways: known or unknown to its designers, safe or unsafe. ISO 21448's aim is to grow the known-safe area at the expense of the other three: move known-unsafe situations to safe by changing the function (better sensing, a smaller domain, a slower speed), and find the unknown-unsafe ones by analysis and by searching for them, so that what is left in the unknown-unsafe area is small enough to accept.

**Does the stack notice?** For faults it mostly does: the health lights and the Sensors switchboard were built to say what was lost. For triggering conditions it mostly does not: no light watches the fog, the person who turns back is predicted to keep walking until the contact, and the sonar's dead zone reports nothing at all. A condition the stack can notice can be answered with a degraded mode; one it cannot has to be answered in the design or the domain.

**Measured** on L5 at seed 7, up to Mission complete, nothing broken in any run:

| Condition | Insufficiency it exposes | Seed 7 | Seeds 2–5 |
| --- | --- | --- | --- |
| a person turning back at the end of their walk | constant-velocity prediction | 1 bump at 51.6 s, 0.73 m/s | the same contact at 51–52 s on every seed |
| the same, with the learned predictor's three futures | the predictor's own gaps | the 51 s contact gone; a strike at 100.6 s, 1.35 m/s | gone on every seed; a contact near 102 s on 2 of 4 |
| fog | lidar reach and returns from the air | 10 yields against 4; a strike at 101 s, 1.45 m/s | more yields on every seed (9–15 against 5–8) |
| the particle filter's seed 1 | unlabeled beacons in a repeating warehouse | 63 relocalizations, 249 s, 2 strikes at 1.05 m/s | (seed 1 only) |
| a person inside 0.2 m, sonar safety stop | the sonar's dead zone | 2 bumps at 21.5 and 43.9 s | the same two on every seed; none with the lidar stop |

[try: The busy floor, nothing changed | {"sim":true,"level":4,"tab":"ctl"}] [try: Fog | {"sim":true,"level":4,"set":{"weather":"fog"},"tab":"per"}]

## 6. Faults, detection and the time budget

**Three moments.** A fault at $t_f$; its detection at $t_d$; the harm it would lead to, if nothing reacted, at $t_h$. ISO 26262 calls $t_h - t_f$ the fault tolerant time interval (part 1, clause 3) and asks for safety mechanisms whose detection and reaction fit inside it (part 4, clause 6):
$$
(t_d - t_f) + T_{react} < t_h - t_f .
$$
The interval belongs to the situation as much as to the robot: the same fault is urgent in a crowded aisle and harmless on an empty floor, so a design takes the worst case it can find over the domain. A fault that is never detected has $t_d = \infty$: no safety mechanism covers it, nothing reacts, and only the design can make it safe.

**The fault schedule.** The lab breaks things on a timetable: the setting `sched` lists events such as switching a sensor off, turning beacons off or biasing a motor at a given second, and the event log says when each happens. It is a setting like any other, so a Try, an Experiments run, a search or a level file can carry it, and a reset replays it. The kidnapped-robot experiments of the localization lessons use it too.

**Detection.** The health lights are the stack's detection, and the simulator records when each first turned amber or red, in the page and headless alike. Measured on L5 at seed 7, faults at 30 s, up to Mission complete (seeds 2–5 in brackets):

| Fault at 30 s | Detected | First harm | Reaction | Outcome |
| --- | --- | --- | --- | --- |
| lidar off | 30.5 s, Perceive amber (every seed) | strike at 51.3 s, 1.36 m/s | none | 3 strikes, 5/5 in 106 s (the same on 2, 3, 5; on 4 the filter loses the robot at 42.5 s and it holds) |
| lidar off, slow to 0.3 m/s at 31 s | 30.5 s | none | in time | no contact; 1/5 goals in 300 s, lost at 61.5 s (no strike on any seed) |
| lidar off, slow to 0.3 m/s at 52 s | 30.5 s | strike at 51.3 s, 1.36 m/s | too late | the same first strike (every seed) |
| every beacon off | 40.5 s, Localize red (37.5–46.5 s) | strike at 120.5 s, 1.07 m/s | the lost guard holds and relocalizes, 64 times | 5/5 in 158 s instead of 121 |
| one motor weaker (+0.3 rad/s turn) | not detected (no light until a person is within 0.3 m) | strike at 51.9 s, 1.28 m/s | none | 5 contacts, 4 strikes, wall clearance 0.10 m |

**Failure modes and effects.** A failure-mode analysis (FMEA, ISO 26262 part 9, clause 8) lists, for each part, how it can fail, the effect, how the failure is detected and what reacts. The Sensors switchboard's registry already holds the first two columns for the sensors (what each gives the robot, and what turning it off costs); the measurements above fill the last two, and the empty cells are the design work: the lidar has detection without a reaction, the motor neither.


## 7. Searching the domain

**Scenarios and their margin.** A scenario is a point of the domain: a generated world (its seed, the aisle width, the number of people and of people who wait for the robot), the weather, whether the people react, and the run's seed. Its run gets a margin, lower being worse,
$$
m = \begin{cases} -\max_c v_{rel,c} & \text{if the run had a contact} \\ \min(g_{person},\ g_{rack}) & \text{otherwise,} \end{cases}
$$
continuous across the boundary between a near miss and a contact, so that a search can tell a run that almost failed from one that never came close. ISO 21448 asks for exactly this pair of activities: evaluate the known scenarios (clause 10) and search for the unknown (clause 11).

**Random sampling, then refinement.** A search with budget $B$ spends $B/2$ runs on scenarios drawn uniformly from the sheet's ranges. The rest go in rounds: each round takes the worst tenth of the runs so far (at least three) and perturbs each of their ranges by $\delta\,(\text{hi} - \text{lo})$ with $\delta$ uniform in $(-f, f)$, keeping the world seed and, half the time, the run seed, with $f = 0.25$ in the first round and $0.125$ in the second. It is the cross-entropy idea in its simplest form: sample, keep the worst, sample again near them. Each batch is drawn from the finished runs before it in index order, so the page's workers and `tools/search.mjs` produce the same runs for the same search seed.

**Measured**, ODD-1 (generated warehouses, 24 × 16 m, aisles 2–3.2 m, up to four scripted people, clear air, the busy floor's settings), 40 runs, two refinement rounds, search seeds 1, 2 and 3:

| Search | Random 20: with a contact (strikes) | Refined 20: with a contact (strikes) | Worst margin |
| --- | --- | --- | --- |
| ODD-1 | 8 (2), 9 (6), 8 (1) | 10 (7), 14 (6), 12 (6) | −1.34, −1.55, −1.50 |
| ODD-1 with up to three people who wait for the robot | 14 (8), 15 (9), 11 (7) | 14 (11), 14 (7), 18 (12) | −1.85, −1.82, −1.75 |
| ODD-1 with the safety stop on | 6 (2), 6 (2), 5 (1) | 13 (3), 12 (5), 5 (2) | −1.21, −1.39, −1.33 |

Refinement finds more runs with a contact than random sampling on every seed; its single worst run is worse on only one of the three, which is why a search is judged by how many failures it finds for its budget. With the safety stop the random half is the same 20 scenarios: per scenario it helps on 6, 10 and 6 of them and makes 2, 0 and 1 worse.

**Sorting what it finds.** Every failure is opened and attributed: a known triggering condition in a new place (search seed 1's worst run is §5's person turning back, head-on in a 2 m aisle) becomes one more scenario in that condition's regression set; a new kind of failure becomes a new row. Kept as a set, the scenarios are rerun after every change, and a change is accepted when the whole set improves, not only the case that motivated it.

[try: Search the busy floor's domain | {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":"ODD-1","budget":40,"rounds":2,"seed":1,"run":true}}]

## 8. Learned blocks: slices and the edge of the data

**Performance by slice.** One number per block hides where it fails. The lab cuts the people detector's recall by range, at every lidar scan of a tracker that detects: a person is *visible* when a beam's true end point lies on their disc (from the true pose), and *found* when a detection lies within 0.6 m of where the estimate's frame puts them; a detection near nobody is false. With $V_s$ visible and $F_s$ found in slice $s$,
$$
r_s = \frac{F_s}{V_s}, \qquad \text{false detections per scan} = \frac{\#\{\text{detections near nobody}\}}{\#\text{scans}} .
$$
The slices are the range (under 2.5 m, 2.5 to 5 m, farther), next to a rack or wall (the disc within 0.4 m of one) or in the open, walking or standing. The predictors are cut the same way: each 2 s prediction is filed by what the person did in those 2 s, walking on as they were, *changing* (turning by more than 30°, stopping or starting) or standing, and by whether they were within 3 m of the robot. ISO/PAS 8800 sets the requirements on the data and its coverage (clause 11) and verifies the trained component against them (clause 12): slices are how a requirement names the situations that matter, and how a test shows they are covered.

**Out of distribution.** Each built-in model carries a reference: the mean $\mu_i$ and spread $\sigma_i$ of a short description $x$ of its inputs over the runs its file lists as its training data, replayed on the headless core (`tools/ood-ref.mjs`; the policy's file lists datasets, so its collector's recipes are replayed). The detector's description is its scan's mean and spread of range, the shares of beams that return and return within 1.5 m, the mean change from the last scan, the speed and turn rate, and the map's mean evidence on the hits (8 numbers); the policy's, its 12 sector minima, mean range, the two shares, the goal distance, speed and turn rate (18); the predictor's, its 24 inputs as they are. The score of an input is
$$
s = \sqrt{\frac1m \sum_{i=1}^{m} \min\!\Bigl(10,\ \frac{|x_i - \mu_i|}{\sigma_i}\Bigr)^{2}} ,
$$
the root mean square of its z-scores, each clipped so one wild element cannot dominate. The threshold $s_{99}$ is the score 99 % of the training inputs stay under: 1.91 for the detector, 2.24 for the predictor, 1.84 for the policy. A block in use whose input is above it for more than half of the last 5 s turns its subsystem's light amber. It is the simplest monitor that works, a diagonal Gaussian; it is blind to anything its description leaves out, and it says nothing about whether the block's answer is right. ISO/PAS 8800 asks for such measures in operation (clause 14). A model trained in the Train tab carries the reference of its own training data.

**Measured**, L5 at seed 7 (seeds 2–5 in brackets), up to Mission complete:

| Block and condition | Found: all, under 2.5 m, 2.5–5 m, farther | False per scan | Score outside | Light |
| --- | --- | --- | --- | --- |
| Rule detector, clear | 100, 100, 100, 100 % (the same) | 0.07 (0.03–0.06) | — | — |
| Learned detector, clear | 96, 100, 96, 90 % (far 85–91 %) | 0.03 (0.03–0.06) | 1 % | none |
| Learned detector, seed 1 (the filter keeps losing itself) | 90, 97, 95, 79 % | 0.32 (the rule: 2.98) | 1 % | none |
| Learned detector, fog | 92, 100, 89 % (one person farther: the fog's reach is about 4 m) | 6.99 (6.8–7.3) | 96 % | amber at 0.5 s (every seed) |
| Learned detector, rain | 94, 100, 97, 81 % | 2.66 (2.7–3.1) | 13 % (10–12 %) | first at 107.5 s (109.5–138.5 s; seed 1 never) |

| Predictor, error at 2 s | Steady walkers | Changing course | Share changing |
| --- | --- | --- | --- |
| Learned | 0.28 m (0.20–0.25) | 0.78 m (0.66–0.80) | 6 % (6–8 %) |
| Constant velocity | 0.36 m (0.33–0.37) | 1.61 m (1.38–1.67) | |

The policy on L5, a floor with people it was never trained with: 0.4 % of its inputs outside (0.4–0.5 %), no light, and 4 contacts with people (2, 4, 1, 1) where the classical stack has 1 on each seed. L5's people walk the middle of the aisles, so the slices by a rack and standing are empty there.

[try: The learned detector in fog | {"sim":true,"level":4,"set":{"agents":"learned","weather":"fog"},"tab":"per","layers":{"agents":true,"lidar":true},"panes":[["oodDet"]]}]

## 9. Mitigations and their price

**Modifying the function.** ISO 21448 removes or reduces a functional insufficiency by changing the function: better sensing, a restricted function or domain, a hand-over, a minimal-risk manoeuvre (clause 8), and the changed function is verified again. In the lab the price of a mitigation is availability, the time the robot spends stopped or slowed and the missions it no longer finishes, and its false interventions; the benefit is the contacts and severities it removes. Both are measured on the same scenarios.

**The radar emergency brake.** At each radar scan (10 Hz) it takes the echoes the people tracker would (moving against the static world, or not explained by the map), keeps those ahead within half the body's width plus 0.2 m of the arc the odometry says the robot is turning on, and for each that closes at $v_c > 0.1$ m/s computes the time to contact
$$
T = \frac{d - \ell_f}{v_c},
$$
with $d$ the echo's range and $\ell_f$ the distance from the radar to the body's front. Under $T_{brake}$ (1 s by default) the robot is held at a stop for 0.5 s, renewed by each scan that still sees an echo there. It reads one scan and keeps no track, so it reacts at the radar's rate and in fog; and it cannot tell a person's echo from a ghost or clutter, so some of its stops are for nothing. The simulator knows what each echo was and counts the stops by cause.

**Measured**, L5 up to Mission complete, seed 7 (in brackets seeds 2–5, and seed 1 where named; *still*: a person walked into the stopped robot):

| Condition, mitigation | Contacts with people | Strikes | Stops (for clutter or a rack) | Time stopped or capped | Mission |
| --- | --- | --- | --- | --- | --- |
| Fog, none | 1 | 1 (on 5 of 6 seeds) | — | — | 121 s |
| Fog, radar brake | 0 (seeds 2–5: 2 still; 1 bump; 1 bump and 1 still; 2 still; seed 1: 0) | 0 (none on any seed) | 11 (5 of 11; 2–4 of 5–10) | 7.3 s | 125 s |
| Fog, lidar safety stop | 3 bumps (a contact on every seed) | 0 (on 2 of 6 seeds) | — | 6.2 s capped (4–8 s; seed 1: 53 s) | 118 s |
| Clear, none | 1 bump at 51.6 s | 0 (seeds 1, 3: a strike) | — | — | 121 s |
| Clear, radar brake | 1 still at 52.1 s (a bump at 51–53 s on seeds 2–5) | 0 | 6 (3 of 6; 2–6 of 3–9) | 3.3 s | 123 s |
| Clear, cruise 0.5 m/s | a strike at 126.1 s and a bump at 131.6 s (the same on seeds 2–5) | 1 (on 5 of 6 seeds) | — | — | 178 s |

The brake removes every strike in fog because it reads the one sensor the fog does not reach; the lidar safety stop inherits the lidar's blindness. In clear air the brake costs stops and does little, and the slower robot meets different people at different moments and does worse. The radar brake's case for shipping is "on where a monitor says the lidar is degraded": §8's monitor sees fog in half a second.

[try: Fog, with the radar emergency brake | {"sim":true,"level":4,"set":{"weather":"fog","radar":true,"radBrake":true},"tab":"ctl","layers":{"agents":true,"radar":true}}]

## 10. Rates, intervals and indicators

**A rate from a search.** The random half of a search samples the domain: run $i$ operates for $T_i$ seconds (the time its mission ran) and has $k_i$ events, a contact with a person while the robot moves, a strike, or any contact. The refined half is left out, since it was chosen for being bad. With $T = \sum T_i$ and $k = \sum k_i$ the rate is $\hat\lambda = k/T$. If events arrive independently at a constant rate, $k$ is Poisson with mean $\lambda T$, and the exact (Garwood) 95 % interval is the pair of means for which the observed count sits in the tails:
$$
P(X \ge k;\ \lambda_{lo} T) = 0.025, \qquad P(X \le k;\ \lambda_{hi} T) = 0.025, \qquad P(X \le k;\ m) = \sum_{j=0}^{k} e^{-m}\frac{m^j}{j!} .
$$
The lab solves both by bisection. ISO 21448 turns acceptance criteria into validation targets with exactly this arithmetic (clause 9).

**The rule of three.** With no event, $P(X = 0) = e^{-\lambda T}$. Every $\lambda$ for which that is under 5 % is ruled out at 95 %, one-sided, leaving
$$
\lambda < \frac{-\ln 0.05}{T} = \frac{2.996}{T} \approx \frac{3}{T} ;
$$
the two-sided interval's top for $k = 0$ is $-\ln 0.025/T = 3.69/T$, which is what the Risk table shows. To claim a target $\lambda^*$ takes $3/\lambda^*$ hours without an event: 3 000 hours for one per thousand, 3 million for one per million, which is why no one validates a rare-event target by operating hours alone.

**Importance sampling.** The sampler draws the people from $q(x) = 2x$ over their range ($x$ from 0 to 1) instead of the sheet's uniform $p(x) = 1$, and weights run $i$ by $w_i = p/q = 1/(2x_i)$, clipped at $x = 0.05$. The weighted rate
$$
\hat\lambda_w = \frac{\sum_i w_i k_i}{\sum_i w_i T_i}
$$
estimates the domain's rate, since $E_q[w\,f] = E_p[f]$ for anything the run depends on. Its interval is a bootstrap over the runs (1 000 resamples, a fixed seed); with no event at all, the rule of three on the sample's effective hours $T_{eff} = (\sum w_i T_i)^2 / \sum w_i^2 T_i$. Weights that vary spend sample size: $T_{eff} < T$. Importance sampling pays when the oversampled worlds are where the events happen, and costs when they are not.

**Leading indicators.** For each candidate $m$, its value per hour in each random run is ranked against the run's contacts per hour, and Spearman's $\rho$ (the correlation of the ranks) says how well it orders the runs as the harm does. UL 4600 asks for safety performance indicators, leading ones among them, watched in operation (clause 16).

**Measured**, 40 random runs per search, each to Mission complete:

| Search | Hours | Contacts with a person, per hour (95 %) | Strikes, per hour (95 %) | Leading indicators, ρ |
| --- | --- | --- | --- | --- |
| ODD-1, search seed 1 | 1.27 | 18: 14.1 (8.4–22.3) | 11: 8.6 (4.3–15.4) | under 0.3 m 0.80, closest 0.79, TTC < 1 s 0.70, within 2 m 0.48 |
| ODD-1, seed 2 | 1.37 | 20: 14.6 (8.9–22.5) | 13: 9.5 (5.1–16.2) | 0.86, TTC 0.81, closest 0.77, within 2 m 0.60 |
| ODD-1, seed 3 | 1.24 | 12: 9.7 (5.0–16.9) | 9: 7.2 (3.3–13.7) | 0.72, closest 0.71, TTC 0.63, within 2 m 0.38 |
| ODD-1 importance-sampled, seeds 1–3 | 1.30, 1.37, 1.31 | 13.0, 12.1, 15.9 (weighted) | 7.6, 9.1, 3.9 (weighted) | a closeness measure first, within 2 m last |
| People who react, seeds 1–3 | 1.26, 1.34, 1.24 | 5: 4.0 (1.3–9.3); 0; 0 | 0: below 2.9, 2.8, 3.0 | under 0.3 m 0.66, … within 2 m 0.27 (seed 1) |
| People who react, importance-sampled, seeds 1–3 | 1.33, 1.34, 1.28 | 1.7 weighted; 0; 0 | 0: below 3.75, 4.86, 3.76 | |

On ODD-1 contacts are common, and importance sampling gives the same rates within their intervals, with intervals about as wide (the strikes' a little narrower in absolute terms, but around lower estimates): little to gain where nothing is rare. With people who react there is no strike either way, and importance sampling's bound is wider on every seed, because the weights spent effective hours on worlds that held no strike. Every search with contacts ranks a measure of how close the robot came first and the time with a person within 2 m last: exposure is not a leading indicator.

[try: The busy floor's domain, per hour | {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":"ODD-1","budget":40,"rounds":0,"seed":1,"run":true}}]

