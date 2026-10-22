id: ch8
num: 8
sys: saf
summary: The ideas behind the Safety lessons: the four standards in the lab's own words, the operating domain as a set of conditions, hazard analysis with the lab's severity scale and measured exposure, the safety measures the simulator keeps, and triggering conditions against faults.

# Safety: domains, hazards and triggering conditions

The other chapters ask how each block of the stack works and how it fails. This one asks what a safety engineer asks of the whole: where the stack may be used, which of its failures can hurt someone and how badly, and what makes a stack with nothing broken fail anyway. The vocabulary comes from four standards; the method, on this page, is measurement. Everything here paraphrases the standards and quotes none of them; clause numbers are added to the lessons as they are checked against the licensed texts.

## 1. The four standards, in the lab's words

**ISO 26262 (2018), functional safety.** Risk from *malfunction*: a part of an electrical or electronic system fails, and the design must detect the failure and reach a safe state before harm can follow. Its concept phase defines the *item* (the system, its functions, its boundary) and analyses the hazards its malfunctions could cause, giving each an integrity level that sets how rigorous the rest of the development must be. In the lab: a sensor switched off on the Sensors switchboard, a bias the filters are not told about, a beacon outage, a kidnap.

**ISO 21448 (2022), safety of the intended functionality (SOTIF).** Risk with *nothing broken*: the specified function, or the sensors and algorithms that implement it, is not good enough for some situations. Those gaps are *functional insufficiencies*; the conditions that expose them are *triggering conditions*. In the lab: fog shortening the lidar, a person turning back at the end of their walk, a sonar that cannot hear inside 0.2 m.

**ISO/PAS 8800 (2024), safety and artificial intelligence.** The same two questions for components that are learned rather than written: what the data must cover, how a model is verified, how its errors are analysed, how it is watched in use. In the lab: the learned people detector, the learned predictor and the end-to-end policy.

**ANSI/UL 4600 (third edition, 2023), safety of autonomous products.** A product with no human driver needs a *safety case*: claims, the arguments that connect them, and evidence for each, covering the operating domain, the hazards, every autonomy function and the testing, kept up to date by *safety performance indicators* measured in operation.

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
| GNSS | none (indoors) | Localize → Sensors |
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

**The integrity level.** ISO 26262 combines the three classes, severity in four steps (0 to 3), exposure in five (0 to 4) and controllability in four (0 to 3), into an integrity level from QM (ordinary quality management) through A to D. Its determination table has a simple regularity, which is how the lab states it without reproducing the table: with every class at least 1, the level is D for the sum $s + e + c = 10$ (the worst class on all three scales), C for 9, B for 8, A for 7, and QM below; a class of 0 on any scale gives QM. Each step down in any one scale lowers the level by one step.

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

**The four areas.** Sort the situations a system meets two ways: known or unknown to its designers, safe or unsafe. ISO 21448's aim is to grow the known-safe area at the expense of the other three: move known-unsafe situations to safe by changing the function (better sensing, a smaller domain, a slower speed), and find the unknown-unsafe ones by analysis and by searching for them, so that what is left in the unknown-unsafe area is small enough to accept.

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
