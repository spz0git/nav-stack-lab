id: ch8
num: 8
sys: saf
summary: The ideas behind the Safety lessons: the four standards in the lab's own words, the operating domain as a set of conditions, hazard analysis with the lab's severity scale and measured exposure, the safety measures the simulator keeps, triggering conditions, faults and their time budget, searching the domain for failures, the learned blocks measured by slice and watched for inputs outside their data, mitigations with their price, rates per hour with their intervals and leading indicators, the ODD monitor, and the safety argument kept live.

# Safety: domains, hazards, faults and search

The other chapters ask how each block of the stack works and how it fails. This one asks the questions a safety engineer asks about the whole stack: where it may be used, which of its failures can hurt someone and how badly, and why a stack with nothing broken can still fail. The vocabulary comes from four standards, and the method used here is measurement. The chapter paraphrases the standards and quotes none of them.

## 1. The four standards, in the lab's words

Four published documents give the Safety lessons their vocabulary. Three come from ISO, the International Organization for Standardization, and are written for road vehicles. The fourth, UL 4600, is for any product that works with no human in charge of it. Each link below goes to the publisher's own page for the edition the lab follows. That page describes the document's scope and sells the text.

**ISO 26262, functional safety.** The lab follows the second edition, of 2018, which has twelve parts. The first part defines the vocabulary the others use. The standard deals with risk from *malfunction*. A part of an electrical or electronic system fails, and the design must detect the failure and reach a safe state before harm can follow. The standard starts by defining the *item* (the system, its functions, its boundary). It then analyses the hazards the item's malfunctions could cause, and gives each hazard an integrity level that sets how rigorous the rest of the development must be. In the lab this means a sensor switched off on the Sensors switchboard, a bias the filters are not told about, a beacon outage or a kidnap (chiefly lessons 2 and 4). Part 1 is on ISO's site: [ISO 26262-1:2018](https://www.iso.org/standard/68383.html).

**ISO 21448, safety of the intended functionality (SOTIF).** The lab follows the first edition, of 2022, which replaced a provisional version of 2019. It deals with risk when *nothing is broken*. The specified function, or the sensors and algorithms that carry it out, is not good enough for some situations. Those gaps are *functional insufficiencies*, and the conditions that expose them are *triggering conditions*. The standard starts from the hazards. It goes on to changes to the function, a plan for testing it, and the known and the unknown scenarios, and it ends with a judgement of how much risk is left. In the lab this means fog shortening the lidar, a person turning back at the end of their walk, or a sonar that cannot hear inside 0.2 m (chiefly lessons 3, 5, 7 and 8). [ISO 21448:2022](https://www.iso.org/standard/77490.html) is on ISO's site.

**ISO/PAS 8800, safety and artificial intelligence.** The lab follows the first edition, of December 2024. PAS stands for Publicly Available Specification. ISO publishes one ahead of a full standard while practice in a field is still settling. ISO/PAS 8800 asks ISO 26262's and ISO 21448's questions of components that are learned from data instead of written by hand. It deals with what the data must cover, how a trained model is checked, how its errors are analysed, how it is watched in use, and the argument that ties these together. In the lab this means the learned people detector, the learned predictor and the end-to-end policy (lesson 6). [ISO/PAS 8800:2024](https://www.iso.org/standard/83303.html) is on ISO's site.

**ANSI/UL 4600, safety of autonomous products.** The lab follows the third edition, of March 2023. It is published by UL Standards & Engagement and approved as an American National Standard, which is where the ANSI in its name comes from. It is written for vehicles and other products that operate with no human supervising them, and the third edition added autonomous trucks. It sets no tests to pass. Instead it asks for a *safety case*: claims, the arguments that connect them, and evidence for each. The case covers the operating domain, the hazards, every autonomy function and the testing, and it is kept up to date by *safety performance indicators* measured in operation. In the lab this means the operating domain, the safety performance indicators and the argument itself (chiefly lessons 1, 8 and 9). [UL 4600, third edition](https://www.shopulstandards.com/ProductDetail.aspx?productId=UL4600_3_S_20230317) is in UL Standards & Engagement's shop.

In these lessons the item is always the navigation stack as configured, driving a mission in a level. The lab's robots are a warehouse robot and small cars, while the standards are written for road vehicles and autonomous products. The page uses the standards as a vocabulary and a method. It does not claim that anything here complies with them. The lessons name a standard where its terms help. They never cite its clause numbers, because those point into a text the reader may not have.

## 2. The operating domain

**A set of conditions.** An operating domain (ODD, operational design domain) lists the conditions a system is designed to work in. Write each condition as an attribute $x_i$ of the world, the mission or the robot, with a set $A_i$ of allowed values. The domain is every combination in which each attribute takes an allowed value:
$$
\mathcal{D} = \{\, x : x_i \in A_i \ \text{for every attribute } i \,\}.
$$
A level is inside the domain when every one of its attributes is. This is the sheet for the busy floor, ODD-1:

| Attribute | Allowed | Where the lab sets it |
| --- | --- | --- |
| layout | warehouse rows, aisles at least 2 m | the level; the generator's `aisle` |
| people | at most 4, walking 0.5–0.9 m/s, scripted | the level's people; the generator's `people` |
| weather | clear | Perceive → weather |
| beacons | about one per 32 m², unlabeled | the level; the generator's `beacons` |
| GNSS | none (indoors) | Sensors |
| robot | unicycle, cruise 0.8 m/s | Vehicle, Control |

**What a domain is for.** A domain does three things. It bounds the claims, because "safe enough" is said about $\mathcal{D}$ and not about the world. It sets what the testing must cover, which is a sample of worlds from inside $\mathcal{D}$ and not one level. And it is a boundary that the system should notice crossing. The generator's parameters are attributes of this kind, so the lessons sample generated warehouses. Keeping the same family and seed and moving one attribute across the boundary isolates the effect of that attribute.

**Measured** on the generated warehouse with world seed 2 (24 × 16 m), with L5's settings (particle filter with unlabeled beacons, the speed planner, lidar tracking). The numbers are for run seed 7, with the range over run seeds 1–5 in brackets, counted up to Mission complete:

| World | Goals, time | Rack contacts | Person contacts | Wall clearance | Under 0.3 m of a person |
| --- | --- | --- | --- | --- | --- |
| inside: aisles 2 m, 4 people | 5/5, 102 s | 0 (0–1) | 1 (1–2) | 0.24 m | 2.5 s (1.8–5.4) |
| aisles 1.2 m | 5/5, 147 s | 2 (3–5) | 4 (3–5) | 0.08 m | 9.2 s (5.4–10.0) |
| 8 people | 5/5, 124 s | 1 (0–1) | 3 (2–8) | 0.04 m | 8.6 s (3.7–15.6) |
| fog | 5/5, 101 s | 0 (0–1) | 3 (1–4) | 0.22 m | 13.1 s (1.8–9.8) |

Two of the narrow-aisle runs did not finish in 300 s. The person contacts counted here include a person walking into the stopped robot.

**Margins.** The narrow aisles show where a boundary comes from. The robot is 0.6 m across, so a 1.2 m aisle leaves $m = (1.2 - 0.6)/2 = 0.3$ m on each side when the robot is centred. Every error uses up part of that margin: the particle filter's position error $e_p$, the tracker's cross-track error $e_c$ and the turn into the aisle. The robot touches the rack once $e_p + e_c > m$. In 2 m aisles $m = 0.7$ m, which is more than the errors of this stack. In 1.2 m aisles it is less. The costmap reflects this as well. Its inflation band reaches 0.6 m from each rack, which covers the whole width of a 1.2 m aisle. On this world the planner reports at 23 s that it found no path. That is the only place where the stack itself notices the boundary.

**Observability.** The robot can measure some attributes while it drives. It gets the aisle width from its map, the people from its tracks, the beacons from their silence and the fog from how few lidar beams return. Others it cannot measure, such as the floor's grip, until a wheel slips. For the first kind a monitor can stop or slow the robot at the boundary. For the second kind, whoever puts the robot to work has to enforce the domain.

## 3. Hazard analysis and risk assessment

**From situations to hazardous events.** A *hazard* is something the robot can do that could hurt someone, such as driving into a person, driving into a rack, or stopping where a person walks into it. A *hazardous event* is a hazard in an *operational situation*, such as driving down an aisle while a person walks along it, or reversing out of a parking bay with people in the lane. The analysis lists the situations and the hazards in each, and it rates each pair on three scales.

**Severity, the lab's scale.** The standards rate severity by the injuries that are likely. The lab has no injuries, so it rates the relative speed at contact,
$$
v_{rel} = \lVert \mathbf v_r - \mathbf v_p \rVert,
$$
that is, the robot's true velocity minus the person's (a rack's velocity is zero). The lab sorts it into three classes of its own: *touch* below 0.3 m/s, *bump* from 0.3 to 1 m/s and *strike* above 1 m/s. The simulator records every contact with its $v_{rel}$ and class (Metrics → Contacts by speed). This scale is the lab's own and comes from no standard. To rate an integrity level, the lab lets touch, bump and strike stand for the standard's S0, S1 and S2 (no injuries; light or moderate injuries; severe injuries with survival likely). It uses no S3 (life-threatening or fatal). This mapping is an assumption made for teaching.

**Exposure, measured.** Exposure is how often the situation occurs. The lab measures it as the share of the operating time $T_{op}$ (the time the mission runs) spent in the situation,
$$
E_s = \frac{T_s}{T_{op}}.
$$
The lab counts $T_s$ for two situations: a person within 2 m (Metrics → Person within 2 m) and reversing. Exposure depends on the domain and the mission, and also on the robot's behaviour. The speed planner waits near people, so a robot that uses it spends more time near them than a robot that ignores them.

**Controllability.** Controllability is whether the people involved can avoid the harm by reacting in time. ISO 26262 counts everyone exposed, not only a driver, so passengers, pedestrians and anyone nearby count too. With no driver, the people involved are the people around the robot. Scripted people never step aside, and reacting people (Vehicle → People → Reactive) do. Comparing the two on the same seeds measures the share of harm that the people avoid by themselves. Most analyses of driverless systems take no credit for this, because a person who is looking at a phone, or carrying a box, does not step aside. The robot's own reaction is left out of controllability. The analysis rates what happens when the robot's behaviour goes wrong. The robot's planner, brakes and monitors are the things the integrity level asks to be made good enough. Counting them in controllability as well would credit the same protection twice.

**The robot's side: the avoidance margin.** The lab treats the robot's own ability to avoid a contact separately. With $TTC$ the time to contact (gap over closing speed), $t_{react}$ the time before braking starts, $v$ the robot's speed and $a_{max}$ its braking limit,
$$
t_{stop} = t_{react} + \frac{v}{a_{max}}, \qquad m = TTC - t_{stop},
$$
and a negative margin $m$ means the robot can no longer stop in time. On L5 (0.8 m/s, 0.8 m/s², a 0.15 s actuator lag) $t_{stop}$ is about 1.2 s. Metrics → Time to contact shows the smallest value in the run and the seconds spent under 1 s. The margin counts as evidence for the safety goal. It is not an input to the rating.

**The integrity level.** ISO 26262 combines the three classes into an integrity level that runs from QM (ordinary quality management) through A to D. Severity has four steps (0 to 3), exposure five (0 to 4) and controllability four (0 to 3). The standard's determination table follows a simple rule, and the lab states the rule instead of reproducing the table. If every class is at least 1, the level is D for the sum $s + e + c = 10$ (the worst class on all three scales), C for 9, B for 8, A for 7, and QM for anything lower. A class of 0 on any scale gives QM. So each step down on any one scale lowers the level by one step. The standard's informative annex describes the classes in between. Exposure is E2 for a situation that takes up under 1 % of the operating time, E3 for 1 to 10 % and E4 for more than 10 %. Controllability is C1 when 99 % or more of the people involved would avoid the harm, C2 for 90 % or more and C3 for fewer. Rated this way, a robot driving into a person in an aisle of the busy floor is S2 (the strikes at 1.36 to 1.60 m/s), E4 (a person within 2 m for 17 to 30 % of the time) and C3 (no credit for people stepping aside). The sum is 9, which gives level C. With credit for people stepping aside the rating is C2, the sum is 8 and the level is B. Lesson 2 sets these out as tables.

**Safety goals.** Every hazardous event that is given an integrity level gets a safety goal. A safety goal is a top-level requirement, stated in terms that can be checked. The lab's goal for the busy floor is *no contact with a person above 0.3 m/s relative speed while the robot drives*, which means nothing above a touch.

**Measured** on L5, the busy floor, at seed 7, up to Mission complete, with seeds 2–5 in brackets:

| Response to people | People | Contacts, speed and class | Person within 2 m | Mission |
| --- | --- | --- | --- | --- |
| ignore | scripted | 3 strikes: 1.36, 1.40, 1.60 m/s (the same) | 18.5 of 106 s | 5/5 |
| ignore | reacting | 2 bumps: 0.61, 0.87 m/s (2–3 bumps, 0.56–0.91) | 20.9 of 107 s | 5/5 |
| speed planner | scripted | 1 bump: 0.73 m/s (1, 0.71–1.12) | 33.4 of 121 s | 5/5 |
| speed planner | reacting | none (none; a rack contact on 2 of 4) | 37.0 of 122 s | 5/5 |
| MPC with predictions | scripted | 1 bump: 0.65 m/s (0–1) | 25.6 of 129 s | 5/5 |

On L6, the parking lot, at seed 7 there is no contact. The robot reverses for 31.1 of 148 s (30–39 s on seeds 2–5) and has a person within 2 m for 57.6 s. Only one row of the table meets the safety goal on every seed, and that row takes credit for the people stepping aside.

## 4. The safety measures the simulator keeps

None of these measures changes what the robot does, and none of them draws a random number. The runs and the regression are therefore the same with or without them. They are kept from the moment the mission starts, and the time-based ones stop counting at Mission complete.

**Contacts by speed.** At the first tick of each contact the simulator records the time, the place, the kind (rack or person, and whether the robot was standing still), $v_{rel}$ and its class. It also records the settings that differ from the defaults, such as the weather, a sensor switched off or the odometry bias. For a rack $v_{rel}$ is the robot's speed just before the contact.

**Wall clearance.** This is the smallest gap between the true footprint and a static obstacle over the run,
$$
g_{obs} = \min_t \min_k \bigl( D(\mathbf c_k(t)) - r_k \bigr),
$$
where $D$ is the distance field of the true occupancy (0.1 m cells, the same field the costmap's inflation uses) and $(\mathbf c_k, r_k)$ are the circles that cover the footprint. The unicycle has one and the car three. The car's circles overstate its corners by up to about 0.14 m, so a car's clearance can read slightly negative with no contact.

**Time to contact.** For each person at relative position $\mathbf d$, with a gap $g > 0$ between the two bodies, the lab computes the closing speed along the line between them. From it, it computes the time it would take to close the gap if both kept their velocities:
$$
\dot d_{close} = -\frac{\mathbf d \cdot (\mathbf v_p - \mathbf v_r)}{\lVert \mathbf d \rVert}, \qquad \tau = \frac{g}{\dot d_{close}} \quad (\dot d_{close} > 0.05 \text{ m/s}).
$$
The Metrics list shows the smallest $\tau$ of the run and the seconds with $\tau < 1$ s.

**Leading indicators.** A contact is a *lagging* indicator, because by the time it is counted the harm has happened. Three other measures move before a contact does, and far more often: the seconds closer than 0.3 m to a person, the seconds with $\tau < 1$ s, and the seconds the safety stop spent capping the speed. That makes them useful to watch, as *leading* indicators. Whether a given one actually predicts contacts has to be measured, and a later lesson measures it.

## 5. Triggering conditions and functional insufficiencies

**Two kinds of failure.** A *fault* is something broken, such as a sensor switched off or a bias the filters are not told about. A *functional insufficiency* is a part of the design that is not good enough while nothing is broken. Examples are a predictor that assumes people keep walking, a lidar that sees 4 m in fog and a sonar that hears nothing inside 0.2 m. A *triggering condition* is a situation that exposes an insufficiency. For those three it is a person turning back beside the robot, fog, and a person very close. ISO 26262 deals with the first kind of failure and ISO 21448 with the second.

**The four areas.** Sort the situations a system meets in two ways: known or unknown to its designers, and safe or unsafe. ISO 21448 aims to grow the known-safe area at the expense of the other three. Known-unsafe situations are made safe by changing the function, for example with better sensing, a smaller domain or a slower speed. Unknown-unsafe ones are found by analysis and by searching for them. The aim is that what is left in the unknown-unsafe area is small enough to accept.

**Does the stack notice?** For faults it mostly does, because the health lights and the Sensors switchboard were built to say what was lost. For triggering conditions it mostly does not. No light watches the fog. The person who turns back is predicted to keep walking until the contact. The sonar's dead zone reports nothing at all. A condition the stack can notice can be answered with a degraded mode. One it cannot notice has to be answered in the design or the domain.

**Measured** on L5 at seed 7, up to Mission complete, with nothing broken in any run:

| Condition | Insufficiency it exposes | Seed 7 | Seeds 2–5 |
| --- | --- | --- | --- |
| a person turning back at the end of their walk | constant-velocity prediction | 1 bump at 51.6 s, 0.73 m/s | the same contact at 51–52 s on every seed |
| the same, with the learned predictor's three futures | the predictor's own gaps | the 51 s contact gone; a strike at 100.6 s, 1.35 m/s | gone on every seed; a contact near 102 s on 2 of 4 |
| fog | lidar reach and returns from the air | 10 yields against 4; a strike at 101 s, 1.45 m/s | more yields on every seed (9–15 against 5–8) |
| the particle filter's seed 1 | unlabeled beacons in a repeating warehouse | 63 relocalizations, 249 s, 2 strikes at 1.05 m/s | (seed 1 only) |
| a person inside 0.2 m, sonar safety stop | the sonar's dead zone | 2 bumps at 21.5 and 43.9 s | the same two on every seed; none with the lidar stop |

[try: The busy floor, nothing changed | {"sim":true,"level":4,"tab":"ctl"}] [try: Fog | {"sim":true,"level":4,"set":{"weather":"fog"},"tab":"per"}]

## 6. Faults, detection and the time budget

**Three moments.** A fault happens at $t_f$ and is detected at $t_d$. If nothing reacted, it would lead to harm at $t_h$. ISO 26262 calls $t_h - t_f$ the fault tolerant time interval. It asks for safety mechanisms whose detection and reaction fit inside that interval:
$$
(t_d - t_f) + T_{react} < t_h - t_f .
$$
The interval depends on the situation as much as on the robot. The same fault is urgent in a crowded aisle and harmless on an empty floor, so a design uses the worst case it can find over the domain. A fault that is never detected has $t_d = \infty$. No safety mechanism covers it and nothing reacts, so only the design can make it safe.

**The fault schedule.** The lab breaks things on a timetable. The setting `sched` lists events, such as switching a sensor off, turning beacons off or biasing a motor, each at a given second. The event log says when each one happens. The schedule is a setting like any other, so a Try, an Experiments run, a search or a level file can carry it, and a reset replays it. The kidnapped-robot experiments of the localization lessons use it too.

**Detection.** The health lights are how the stack detects faults. The simulator records when each light first turned amber or red, in the page and in headless runs alike. Measured on L5 at seed 7, with the faults at 30 s, up to Mission complete (seeds 2–5 in brackets):

| Fault at 30 s | Detected | First harm | Reaction | Outcome |
| --- | --- | --- | --- | --- |
| lidar off | 30.5 s, Perceive amber (every seed) | strike at 51.3 s, 1.36 m/s | none | 3 strikes, 5/5 in 106 s (the same on 2, 3, 5; on 4 the filter loses the robot at 42.5 s and it holds) |
| lidar off, slow to 0.3 m/s at 31 s | 30.5 s | none | in time | no contact; 1/5 goals in 300 s, lost at 61.5 s (no strike on any seed) |
| lidar off, slow to 0.3 m/s at 52 s | 30.5 s | strike at 51.3 s, 1.36 m/s | too late | the same first strike (every seed) |
| every beacon off | 40.5 s, Localize red (37.5–46.5 s) | strike at 120.5 s, 1.07 m/s | the lost guard holds and relocalizes, 64 times | 5/5 in 158 s instead of 121 |
| one motor weaker (+0.3 rad/s turn) | not detected (no light until a person is within 0.3 m) | strike at 51.9 s, 1.28 m/s | none | 5 contacts, 4 strikes, wall clearance 0.10 m |

**Failure modes and effects.** A failure-mode analysis (FMEA, one of the analyses ISO 26262 asks for) lists four things for each part: how it can fail, the effect, how the failure is detected and what reacts. For the sensors, the Sensors switchboard's registry already holds the first two columns (what each sensor gives the robot, and what turning it off costs). The measurements above fill the last two. The empty cells are the design work still to do. The lidar has detection without a reaction, and the motor has neither.


## 7. Searching the domain

**The three seeds.** A seed is the number that starts a random number generator. The same seed gives the same draws, and so the same run. Another seed gives another run of the same robot, just as likely as the first. The lab has three seeds. The *world seed* belongs to the level generator (the seed box in the level menu) and fixes a generated warehouse: its racks, its beacons and the routes the people walk. The *run seed* (Vehicle → Random seed, 7 by default) fixes every random draw inside one run, such as the sensor noise, the particle filter's particles and a sampling planner's samples. The *search seed* (Tools → Safety) fixes the search's own draws. These decide which worlds and run seeds the search draws at random, and how each round perturbs the worst runs (both are described below). So a scenario carries two seeds, its world's and its run's. A search carries a third, which decides which scenarios it holds. The same search seed on the same sheet and budget gives the same scenarios, and so the same runs. Every number the lessons quote is for stated seeds, and setting those seeds shows it again. A result over "run seeds 1 to 5" is five runs of the same robot. How far the result moves between them shows how much a single run can claim.

**Scenarios and their margin.** A scenario is a point of the domain. It consists of a generated world (its seed, the aisle width, the number of people and of people who wait for the robot), the weather, whether the people react, and the run's seed. The scenario's run gets a margin, where lower is worse,
$$
m = \begin{cases} -\max_c v_{rel,c} & \text{if the run had a contact} \\ \min(g_{person},\ g_{rack}) & \text{otherwise,} \end{cases}
$$
The margin is continuous across the boundary between a near miss and a contact, so a search can tell a run that almost failed from one that never came close. ISO 21448 asks for these two activities: evaluate the known scenarios and search for the unknown ones.

**Random sampling, then refinement.** A search with budget $B$ spends $B/2$ runs on scenarios drawn uniformly from the sheet's ranges. These runs are the search's random half. The rest go in rounds. Each round takes the worst tenth of the runs so far (at least three) and perturbs each of their attributes that has a range by $\delta\,(\text{hi} - \text{lo})$, where hi and lo are the ends of the attribute's range and $\delta$ is uniform in $(-f, f)$. The perturbed scenario keeps the world seed, and half the time it also keeps the run seed. The width is $f = 0.25$ in the first round and $0.125$ in the second. This is the cross-entropy method in its simplest form: sample, keep the worst, and sample again near them. Each batch is drawn from the finished runs before it, in index order, so the page's workers and `tools/search.mjs` produce the same runs for the same search seed.

**Measured** on ODD-1 (generated warehouses, 24 × 16 m, aisles 2–3.2 m, up to four scripted people, clear air, the busy floor's settings), with 40 runs, two refinement rounds and search seeds 1, 2 and 3:

| Search | Random 20: with a contact (strikes) | Refined 20: with a contact (strikes) | Worst margin |
| --- | --- | --- | --- |
| ODD-1 | 8 (2), 9 (6), 8 (1) | 10 (7), 14 (6), 12 (6) | −1.34, −1.55, −1.50 |
| ODD-1 with up to three people who wait for the robot | 14 (8), 15 (9), 11 (7) | 14 (11), 14 (7), 18 (12) | −1.85, −1.82, −1.75 |
| ODD-1 with the safety stop on | 6 (2), 6 (2), 5 (1) | 13 (3), 12 (5), 5 (2) | −1.21, −1.39, −1.33 |

On every seed, refinement finds more runs with a contact than random sampling does. Its single worst run is worse on only one of the three seeds. For that reason a search is judged by how many failures it finds for its budget. With the safety stop on, the random half is the same 20 scenarios as without it. Scenario by scenario, the stop helps on 6, 10 and 6 of them and makes 2, 0 and 1 worse.

**Sorting what it finds.** Every failure is opened and traced to its cause. A known triggering condition in a new place becomes one more scenario in that condition's regression set. Search seed 1's worst run is an example: it is §5's person turning back, met head-on in a 2 m aisle. A new kind of failure becomes a new row in §5's table. The scenarios are kept as a set and rerun after every change. A change is accepted when the whole set improves, not only the case that motivated it.

[try: Search the busy floor's domain | {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":"ODD-1","budget":40,"rounds":2,"seed":1,"run":true}}]

## 8. Learned blocks: slices and the edge of the data

**Performance by slice.** A single number per block hides where the block fails. The lab therefore splits the people detector's recall (the share of the visible people it finds) into slices, starting with range. It does this at every lidar scan of a tracker that detects people. A person is *visible* when the true end point of a beam lies on their disc (computed from the true pose). A person is *found* when a detection lies within 0.6 m of where the estimate's frame puts them. A detection near nobody is a false detection. With $V_s$ visible and $F_s$ found in slice $s$,
$$
r_s = \frac{F_s}{V_s}, \qquad \text{false detections per scan} = \frac{\#\{\text{detections near nobody}\}}{\#\text{scans}} .
$$
The slices are by range (under 2.5 m, 2.5 to 5 m, farther), by place (next to a rack or wall, meaning the disc is within 0.4 m of one, or in the open) and by motion (walking or standing). The predictors are sliced the same way. Each 2 s prediction is filed by what the person did in those 2 s: walking on as they were, *changing* (turning by more than 30°, stopping or starting), or standing. It is also filed by whether the person was within 3 m of the robot. ISO/PAS 8800 sets the requirements on the data and its coverage, and verifies the trained component against them. Slices are how a requirement names the situations that matter, and how a test shows that they are covered.

**Out of distribution.** Each built-in model carries a reference for its inputs. The inputs are summarized by a short description $x$, a few numbers per input. The reference is the mean $\mu_i$ and spread $\sigma_i$ of each element of the description over the runs that the model's file lists as its training data. The lab gets them by replaying those runs on the headless core (`tools/ood-ref.mjs`). The policy's file lists datasets instead of runs, so its collector's recipes are replayed. The detector's description has 8 numbers: its scan's mean and spread of range, the shares of beams that return and that return within 1.5 m, the mean change from the last scan, the speed and turn rate, and the map's mean evidence on the hits. The policy's has 18: its 12 sector minima, the mean range, the two shares, the goal distance, the speed and the turn rate. The predictor's is its 24 inputs as they are. The score of an input is
$$
s = \sqrt{\frac1m \sum_{i=1}^{m} \min\!\Bigl(10,\ \frac{|x_i - \mu_i|}{\sigma_i}\Bigr)^{2}} ,
$$
This is the root mean square of the input's z-scores, each clipped at 10 so that one wild element cannot dominate. The threshold $s_{99}$ is the score that 99 % of the training inputs stay under. It is 1.91 for the detector, 2.24 for the predictor and 1.84 for the policy. If a block in use has its input above the threshold for more than half of the last 5 s, its subsystem's light turns amber. This is the simplest monitor that works. It treats the description as a Gaussian with independent elements (a diagonal covariance). It cannot see anything the description leaves out, and it says nothing about whether the block's answer is right. ISO/PAS 8800 asks for measures like this in operation. A model trained in the Train tab carries the reference of its own training data.

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

On L5, a floor with people the policy was never trained with, 0.4 % of its inputs are outside (0.4–0.5 %), no light comes on, and it has 4 contacts with people (2, 4, 1 and 1 on seeds 2 to 5), where the classical stack has 1 on each seed. L5's people walk the middle of the aisles, so the slices next to a rack and standing are empty there.

[try: The learned detector in fog | {"sim":true,"level":4,"set":{"agents":"learned","weather":"fog"},"tab":"per","layers":{"agents":true,"lidar":true},"panes":[["oodDet"]]}]

## 9. Mitigations and their price

**Modifying the function.** ISO 21448 removes or reduces a functional insufficiency by changing the function. The change can be better sensing, a restricted function or domain, a hand-over or a minimal-risk manoeuvre, and the changed function is then verified again. In the lab a mitigation has two costs. One is availability: the time the robot spends stopped or slowed, and the missions it no longer finishes. The other is its false interventions. Its benefit is the contacts it removes and the severities it lowers. Costs and benefit are measured on the same scenarios.

**The radar emergency brake.** At each radar scan (10 Hz) the brake takes the echoes the people tracker would take: those moving against the static world, or not explained by the map. It keeps the ones ahead that lie within half the body's width plus 0.2 m of the arc the robot is turning on, as the odometry gives it. For each echo that closes at $v_c > 0.1$ m/s it computes the time to contact
$$
T = \frac{d - \ell_f}{v_c},
$$
with $d$ the echo's range and $\ell_f$ the distance from the radar to the body's front. If $T$ is under $T_{brake}$ (1 s by default), the robot is held at a stop for 0.5 s. Each scan that still sees an echo there renews the hold. The brake reads one scan at a time and keeps no track, so it reacts at the radar's rate, and it works in fog. It cannot tell a person's echo from a ghost or from clutter, so some of its stops are for nothing. The simulator knows what each echo was and counts the stops by cause.

**Measured**, L5 up to Mission complete, seed 7 (in brackets seeds 2–5, and seed 1 where named; *still* means a person walked into the stopped robot):

| Condition, mitigation | Contacts with people | Strikes | Stops (for clutter or a rack) | Time stopped or capped | Mission |
| --- | --- | --- | --- | --- | --- |
| Fog, none | 1 | 1 (on 5 of 6 seeds) | — | — | 121 s |
| Fog, radar brake | 0 (seeds 2–5: 2 still; 1 bump; 1 bump and 1 still; 2 still; seed 1: 0) | 0 (none on any seed) | 11 (5 of 11; 2–4 of 5–10) | 7.3 s | 125 s |
| Fog, lidar safety stop | 3 bumps (a contact on every seed) | 0 (on 2 of 6 seeds) | — | 6.2 s capped (4–8 s; seed 1: 53 s) | 118 s |
| Clear, none | 1 bump at 51.6 s | 0 (seeds 1, 3: a strike) | — | — | 121 s |
| Clear, radar brake | 1 still at 52.1 s (a bump at 51–53 s on seeds 2–5) | 0 | 6 (3 of 6; 2–6 of 3–9) | 3.3 s | 123 s |
| Clear, cruise 0.5 m/s | a strike at 126.1 s and a bump at 131.6 s (the same on seeds 2–5) | 1 (on 5 of 6 seeds) | — | — | 178 s |

The brake removes every strike in fog because it reads the one sensor the fog does not reach. The lidar safety stop inherits the lidar's blindness. In clear air the brake adds stops and does little else. The slower robot meets different people at different moments, and it does worse. So the case for shipping the radar brake is to switch it on where a monitor says the lidar is degraded. §8's monitor sees fog in half a second.

[try: Fog, with the radar emergency brake | {"sim":true,"level":4,"set":{"weather":"fog","radar":true,"radBrake":true},"tab":"ctl","layers":{"agents":true,"radar":true}}]

## 10. Rates, intervals and indicators

**A rate from a search.** The random half of a search is a sample of the domain. Run $i$ operates for $T_i$ seconds (the time its mission ran) and has $k_i$ events. Depending on the rate, an event is a contact with a person while the robot moves, a strike, or any contact. The refined half is left out, because it was chosen for being bad. With $T = \sum T_i$ and $k = \sum k_i$, the rate is $\hat\lambda = k/T$. If events arrive independently at a constant rate, $k$ is Poisson with mean $\lambda T$. The exact (Garwood) 95 % interval runs between the two means that put the observed count at the edge of a 2.5 % tail, one on each side:
$$
P(X \ge k;\ \lambda_{lo} T) = 0.025, \qquad P(X \le k;\ \lambda_{hi} T) = 0.025, \qquad P(X \le k;\ m) = \sum_{j=0}^{k} e^{-m}\frac{m^j}{j!} .
$$
The lab solves both equations by bisection. ISO 21448 uses this arithmetic to turn acceptance criteria into validation targets.

**The rule of three.** With no event, $P(X = 0) = e^{-\lambda T}$. Every $\lambda$ for which this probability is under 5 % is ruled out at 95 % (one-sided). That leaves
$$
\lambda < \frac{-\ln 0.05}{T} = \frac{2.996}{T} \approx \frac{3}{T} ;
$$
and the top of the two-sided interval for $k = 0$ is $-\ln 0.025/T = 3.69/T$. The Risk table shows this top. To claim a target $\lambda^*$ takes $3/\lambda^*$ hours without an event. That is 3 000 hours for one event per thousand hours, and 3 million for one per million. For this reason no one validates a rare-event target by operating hours alone.

**Importance sampling.** The sampler draws the people from $q(x) = 2x$ over their range ($x$ from 0 to 1) instead of the sheet's uniform $p(x) = 1$, so it favours worlds with more people. It then weights run $i$ by $w_i = p/q = 1/(2x_i)$, clipped at $x = 0.05$. The weighted rate
$$
\hat\lambda_w = \frac{\sum_i w_i k_i}{\sum_i w_i T_i}
$$
estimates the domain's rate, since $E_q[w\,f] = E_p[f]$ for any quantity $f$ of the run. Its interval comes from a bootstrap over the runs (1 000 resamples, with a fixed seed). With no event at all, the lab uses the rule of three on the sample's effective hours $T_{eff} = (\sum w_i T_i)^2 / \sum w_i^2 T_i$. Weights that vary use up sample size, so $T_{eff} < T$. Importance sampling helps when the events happen in the oversampled worlds, and it hurts when they do not.

**Leading indicators.** Each candidate measure $m$ is taken per hour in each random run, and these values are ranked against the runs' contacts per hour. Spearman's $\rho$ (the correlation of the ranks) says how well the measure puts the runs in the same order as the harm does. UL 4600 asks for safety performance indicators to be watched in operation, leading ones among them.

**Measured** on 40 random runs per search, each to Mission complete:

| Search | Hours | Contacts with a person, per hour (95 %) | Strikes, per hour (95 %) | Leading indicators, ρ |
| --- | --- | --- | --- | --- |
| ODD-1, search seed 1 | 1.27 | 18: 14.1 (8.4–22.3) | 11: 8.6 (4.3–15.4) | under 0.3 m 0.80, closest 0.79, TTC < 1 s 0.70, within 2 m 0.48 |
| ODD-1, seed 2 | 1.37 | 20: 14.6 (8.9–22.5) | 13: 9.5 (5.1–16.2) | 0.86, TTC 0.81, closest 0.77, within 2 m 0.60 |
| ODD-1, seed 3 | 1.24 | 12: 9.7 (5.0–16.9) | 9: 7.2 (3.3–13.7) | 0.72, closest 0.71, TTC 0.63, within 2 m 0.38 |
| ODD-1 importance-sampled, seeds 1–3 | 1.30, 1.37, 1.31 | 13.0, 12.1, 15.9 (weighted) | 7.6, 9.1, 3.9 (weighted) | a closeness measure first, within 2 m last |
| People who react, seeds 1–3 | 1.26, 1.34, 1.24 | 5: 4.0 (1.3–9.3); 0; 0 | 0: below 2.9, 2.8, 3.0 | under 0.3 m 0.66, … within 2 m 0.27 (seed 1) |
| People who react, importance-sampled, seeds 1–3 | 1.33, 1.34, 1.28 | 1.7 weighted; 0; 0 | 0: below 3.75, 4.86, 3.76 | |

On ODD-1 contacts are common. Importance sampling gives the same rates within their intervals, and the intervals are about as wide. The strikes' intervals are a little narrower in absolute terms, but around lower estimates. Where nothing is rare there is little to gain. With people who react there is no strike with either sampler, and importance sampling's bound is wider on every seed. The weights spent effective hours on worlds that held no strike. Every search with contacts ranks a measure of how close the robot came first, and the time with a person within 2 m last. Exposure is therefore not a leading indicator.

[try: The busy floor's domain, per hour | {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":"ODD-1","budget":40,"rounds":0,"seed":1,"run":true}}]

## 11. The safety argument and the ODD monitor

**The argument as data.** The argument is stored as nodes. A node is a goal (a claim), a strategy (how a goal is broken down), a solution (evidence), or a context, an assumption or a justification. The last three are what a goal leans on, and they are drawn beside it. Each node hangs from its parent by a supporting link or a context link. A solution names what to run and what must hold. What to run is either *runs*, a configuration at a list of seeds, or a *search* of a sheet, read on its random half. What must hold is a metric with a bound,
$$
\text{pass}(E) = \bigl[\, m(E) \ \mathrm{op}\ v(E) \,\bigr], \qquad \text{status}(G) = \begin{cases} \text{fail} & \text{if any supporting child fails} \\ \text{pass} & \text{if every supporting child passes} \\ \text{open} & \text{otherwise.} \end{cases}
$$
The metrics are contacts with a person while the robot moves, strikes, the fastest contact with a rack, the fastest with a person, when the ODD monitor first saw the robot outside, the worst seed's share of goals, and a search's upper 95 % rate bounds (§10). Context, assumptions and justifications are not judged. A reader checks them by hand. UL 4600 makes such a case the centre of a safety assessment and asks that it be kept current. ISO 26262 and ISO/PAS 8800 ask for one too.

**Checking it.** The check lists every solution's runs. The changes typed for every run are added on top of each one. They override the solution's own settings, so a change can break the evidence. A run that two solutions share is run once. Each solution's verdict comes from its runs' summaries, and the goals' statuses follow from the verdicts. The page and `tools/argument.mjs` share the code, so they reach the same verdicts.

**The ODD monitor.** A robot can monitor only what it can observe of its domain. The monitor (off by default) watches two things. The first is the weather, through the lidar's return share: the share of the 120 beams that return, averaged over 2 s. Measured on L5 and on generated warehouses, it is 0.86 to 0.93 in clear air, 0.67 to 0.76 in rain and 0.57 to 0.59 in fog. A threshold at 0.65 therefore sees fog and not rain. The second is the learned blocks in use, through §8's out-of-distribution window. When the robot has been outside for 1 s, the monitor takes a minimal-risk manoeuvre, a crawl at 0.3 m/s or a stop. It keeps to it until the robot has been back inside for 3 s. The floor's grip, the people's intentions and an aisle not yet seen cannot be observed. They need operating rules, which the argument records as assumptions.

**Measured.** The monitor on L5, seed 7 (seeds 1–5 in brackets):

| Condition | First outside | Outside | Strikes | Mission |
| --- | --- | --- | --- | --- |
| Clear | never (never) | 0 s | the same as with the monitor off, run for run | 121 s |
| Fog, crawl | 1.95 s (1.95 s) | 254 s | none (1 on seed 2; 5 of 6 seeds have one without it) | 286 s (272–296 s; seed 1: 300 s, 1 goal) |
| Fog, stop | 1.95 s (1.95 s) | the rest of the run | none | no goal reached; the mission gives them up by 81 s |
| Rain | 102.7 s (94–292 s on 3 more; never on 2) | 12 s (8–13 s) | 0 (2, 2, 3, 3, 0) | 131 s |

ARG-1, the busy floor within ODD-1 with people who give way, checked with `tools/argument.mjs` and in the page (47 runs):

| Changes for every run | No contact, six runs | No strike, search | Rack ≤ 0.3 m/s | Fog within 2 s | Top claim |
| --- | --- | --- | --- | --- | --- |
| none | 0: pass | 0: pass | 0.52 m/s (seed 3): fail | 1.95 s: pass | not supported |
| people who do not react | 7: fail | 11: fail | 0: pass | 1.95 s: pass | not supported |
| the monitor off | 0: pass | 0: pass | 0.52: fail | never: fail | not supported |
| a defeater added: people who step out (40 runs, still giving way) | | | | | not supported: 11 contacts, no strike (12 and 8 at search seeds 2 and 3) |

[try: Check the argument | {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"arg":"ARG-1","argSet":{},"check":true}}]

