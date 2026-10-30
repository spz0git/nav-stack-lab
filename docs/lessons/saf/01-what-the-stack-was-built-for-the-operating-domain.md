group: saf
title: What the stack was built for: the operating domain

<p><b>Why this matters.</b> Every lesson so far has run the stack on a level someone chose. A robot that goes to work does not get to choose: the next warehouse has narrower aisles, more people, a door left open to the rain. The first thing a safety case says is where the robot is meant to work, because every later claim, "it is safe enough", "we tested it enough", is a claim about that place and no other. That statement is the operating domain (ODD, operational design domain). This lesson writes one for the busy floor's stack and then tests it the way the domain asks to be tested: inside, and just outside, one boundary at a time.</p>
<p><b>In the standards.</b> UL 4600 wants a safety case to begin by saying where the robot will work, because every later claim holds only there, and it wants the robot to recognise when it has left that place. ISO 21448 wants the same conditions written into what the stack is specified to do, and ISO/PAS 8800 wants the data the learned blocks were trained on to cover them. The four standards are introduced in <a class="chref" href="#notes=ch8/1-the-four-standards-in-the-lab-s-words">chapter 8 §1</a>.</p>
<p><b>The idea.</b> Write each condition as an attribute $x_i$ with a set $A_i$ of allowed values. The domain is every combination inside all of them, and a level is in it when every attribute is:</p>
$$\mathcal{D} = \{\, x : x_i \in A_i \ \text{for every } i \,\}$$
<p>ODD-1, the busy floor's domain: warehouse rows with aisles of at least 2 m; at most four people, walking 0.5 to 0.9 m/s, who do not react to the robot; clear air; unlabeled beacons, about one per 32 m²; no GNSS; the unicycle at 0.8 m/s. The world generator's parameters are attributes of exactly this kind, so a generated warehouse with the same seed and one parameter moved isolates that one boundary.</p>
<p><b>Where it comes from.</b> A domain is only as good as the margins behind its limits. In an aisle of width $w$ the 0.6 m robot has $m = (w - 0.6)/2$ a side when centred, and every error eats into it: the particle filter's position error, the tracker's cross-track error, the turn into the aisle. <a class="chref" href="#notes=ch8/2-the-operating-domain">The domain as a set, the margins, what the robot can observe, and the measured table: chapter 8 §2</a></p>
<p><b>What the lab does.</b> The experiments run one generated warehouse, seed 2, 24 × 16 m, with the busy floor's settings: the particle filter with unlabeled beacons, the speed planner, lidar tracking. The <button type="button" class="linkbtn" data-met="">Metrics list</button> beside the event log has the safety rows: contacts by speed, the wall clearance (the smallest gap between the robot and a rack in the run), the seconds closer than 0.3 m to a person. The numbers are seed 7, counted up to Mission complete; contacts include a person walking into the stopped robot.</p>
<p><b>The seeds.</b> Everything random in the lab is drawn from a seeded generator, so a seed names a run: the same seed gives the same draws and the same run, and another seed is another run of the same robot, just as likely. The lessons quote three kinds. The world seed fixes a generated warehouse: its racks, its beacons and the routes the people walk. It is the seed box in the level menu's generator (2 here; Next seed gives another warehouse of the same kind). The run seed fixes every random draw inside a run: the sensor noise, the particle filter's particles, a sampling planner's samples. It is Vehicle → Random seed, 7 by default, and applies on Reset. The people keep their routes, but a robot that is a little elsewhere meets them at other moments, so the encounters change too. The search seed belongs to Tools → Safety: it fixes which worlds a search picks and how it perturbs the worst of them, so the same search seed gives the same runs again. That is why a number a lesson quotes can be seen again, by setting the same seed. A claim made on one seed is a claim about one run, so the lessons say how the result moves over several ("run seeds 1 to 5").</p>

## Try: Inside the domain: aisles of 2 m, four people
cfg: {"sim":true,"level":{"gen":"warehouse","seed":2,"like":"L5","aisle":2,"people":4},"tab":"mis"}
Setup: A generated warehouse inside ODD-1: 2 m aisles, four people on straight walks, the busy floor's settings, five goals.
See: All five goals in 102 s. One contact with a person, at 25 s and 0.85 m/s, a bump; no contact with a rack, and the wall clearance never falls below 0.24 m. A person is within 2 m of the robot for 21.5 s of the 102.
Shows: Inside the domain the stack does its job, though not perfectly: on run seeds 1 to 5 it makes one or two person contacts and touches a rack once in six runs. A domain does not say the robot is safe inside it. It says where the evidence is collected and where the claims will be made; whether one bump in a hundred seconds is acceptable is the next lesson's question.
Predict: Aisles of 2 m and four people, inside the domain. How many times does the robot touch a rack?
- None, or once at most
- Several times: the racks are close on both sides
- Every time it turns into an aisle
Answer: 0

## Try: Outside: aisles of 1.2 m
cfg: {"sim":true,"level":{"gen":"warehouse","seed":2,"like":"L5","aisle":1.2,"people":4},"tab":"mis"}
Setup: The same world with the aisles narrowed to 1.2 m, one attribute across the boundary. Everything else as before.
See: Two rack contacts, at 108 and 130 s, and four person contacts, three of them strikes above 1 m/s; the wall clearance falls to 0.08 m, and the five goals take 147 s. The planner reports that it found no path at 23 s, and the particle filter relocalizes 36 times.
Shows: The boundary is where the margins run out. A 1.2 m aisle leaves 0.3 m a side for the centred robot, and the position and tracking errors of this stack are of that size; in 2 m aisles it has 0.7 m. The people suffer too: there is no room to wait beside them. On run seeds 1 to 5 the robot touches a rack three to five times, and two of those runs do not finish in 300 s.
Predict: Narrow the aisles to 1.2 m and change nothing else. How many times does the robot touch a rack?
- Two or more
- None: 0.3 m a side is room enough
- Once, at the tightest turn
Answer: 0

## Try: Outside: eight people
cfg: {"sim":true,"level":{"gen":"warehouse","seed":2,"like":"L5","aisle":2,"people":8},"tab":"mis"}
Setup: The 2 m aisles again, now with eight people, twice the domain's limit.
See: Three person contacts, at 25, 80 and 96 s, one of them a strike at 1.41 m/s, and one rack contact. The goals take 124 s. Time near a person, against the run with four:
| People | Closer than 0.3 m to a person (s) | Within 2 m of one (s) |
|---|---|---|
| four | 2.5 | 21.5 |
| eight | 8.6 | 45 |
Look at the first column: twice the people, more than three times as long within 0.3 m.
Shows: Crowding is a boundary too, and its cost grows faster than the count: each extra person is another encounter, and each encounter in an aisle leaves the speed planner fewer gaps to wait for. On run seeds 1 to 5 the eight-person world has two to eight contacts against one or two with four people.
Predict: Double the people to eight, same world, same seed. How many person contacts compared with the four-person run?
- More
- The same: the speed planner handles each person on their own
- Fewer: the robot is slowed down so much it is harmless
Answer: 0

## Think about
Q: Which of ODD-1's attributes could the robot check for itself while it drives?
A: The aisle width, from its own map (the narrow world's "no path" at 23 s is that check, made by accident rather than on purpose); the number and speed of the people, from its tracks; the beacons, from how long they have been silent; the fog, from how few lidar beams return. Not the floor's grip, which it learns only when a wheel slips. For the first kind a monitor can slow or stop the robot at the boundary; the second has to be enforced by whoever puts the robot to work.
Q: Six runs inside the domain were fine, or nearly. Has the inside been shown safe?
A: No. Six runs of one generated world are six samples of a domain with infinitely many worlds in it. The later lessons search the domain for the worlds where the stack fails, and turn runs into a rate with a confidence bound; until then the inside is a claim with some evidence behind it.
Q: Fog moved the contacts on this world from one or two to between one and four depending on the seed. Should fog be inside the domain or outside?
A: That is a decision, not a measurement: the measurement says the stack does worse in fog and is less predictable there. Leaving fog out of the domain makes the claim easier to defend and puts the burden on the operator to keep the robot out of fog, which a robot that cannot tell fog is present (lesson 3) cannot help with.

## Check yourself
Q: The robot is 0.6 m across. In an aisle of 1.4 m, with the particle filter's position error at 0.15 m and the tracker's cross-track error at 0.1 m, how much margin is left on the worse side, in metres?
Answer: 0.15
Tolerance: 0.01
Unit: m
How: Centred, the margin is $m = (1.4 - 0.6)/2 = 0.4$ m a side; the two errors can add on one side, $0.15 + 0.1 = 0.25$ m, leaving $0.4 - 0.25 = 0.15$ m.
