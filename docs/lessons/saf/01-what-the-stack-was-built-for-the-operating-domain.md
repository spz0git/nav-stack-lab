group: saf
title: What the stack was built for: the operating domain

<p><b>Why this matters.</b> Every lesson so far has run the stack on a level someone chose. A robot that goes to work cannot choose its floor. The next warehouse may have narrower aisles, more people, or a door left open to the rain. So the first thing a safety case states is where the robot is meant to work. Every later claim, such as "it is safe enough" or "we tested it enough", holds for that place only. That statement is the operating domain (ODD, operational design domain). In this lesson you write one for the busy floor's stack. Then you test it in a world inside the domain, and in worlds just outside it, moving one boundary at a time.</p>
<p><b>In the standards.</b> UL 4600 asks for a safety case to begin by saying where the robot will work, since every later claim holds only there. It also asks for the robot to recognise when it has left that place. ISO 21448 asks for the same conditions to be written into the stack's specification. ISO/PAS 8800 asks for the data the learned blocks were trained on to cover them. The four standards are introduced in <a class="chref" href="#notes=ch8/1-the-four-standards-in-the-lab-s-words">chapter 8 §1</a>.</p>
<p><b>The idea.</b> Write each condition as an attribute $x_i$ with a set $A_i$ of allowed values. The domain is every combination of values that lies inside all the sets. A level is inside the domain when each of its attributes is inside its set:</p>
$$\mathcal{D} = \{\, x : x_i \in A_i \ \text{for every } i \,\}$$
<p>ODD-1 is the busy floor's domain. It allows warehouse rows with aisles of at least 2 m; at most four people, walking at 0.5 to 0.9 m/s, who do not react to the robot; clear air; unlabeled beacons, about one per 32 m²; no GNSS; and the unicycle at 0.8 m/s. The world generator's parameters are attributes of this kind. If you keep the generator's seed and change one parameter, you get the same warehouse with one boundary moved, and you can see the effect of that boundary on its own.</p>
<p><b>Where it comes from.</b> Each limit of the domain has to sit where the robot still has a margin to spare. In an aisle of width $w$, the 0.6 m robot has $m = (w - 0.6)/2$ to spare on each side when it is centred. Every error uses up part of that margin. The particle filter's position error does, the tracker's cross-track error does, and so does the turn into the aisle. <a class="chref" href="#notes=ch8/2-the-operating-domain">The domain as a set, the margins, what the robot can observe, and the measured table: chapter 8 §2</a></p>
<p><b>What the lab does.</b> The experiments run one generated warehouse, 24 × 16 m, from world seed 2. It uses the busy floor's settings: the particle filter with unlabeled beacons, the speed planner and lidar tracking. The safety rows are in the <button type="button" class="linkbtn" data-met="">Metrics list</button> beside the event log. They give the contacts by speed, the wall clearance (the smallest gap between the robot and a rack in the run) and the seconds spent closer than 0.3 m to a person. The numbers quoted are for run seed 7, counted up to Mission complete. The contacts include those where a person walks into the robot while it is stopped.</p>
<p><b>The seeds.</b> Everything random in the lab comes from a seeded generator. The same seed gives the same run; another seed gives another run of the same robot, just as likely. The lessons use three seeds. The world seed fixes a generated warehouse: its racks, its beacons and the routes the people walk. You set it in the seed box of the level menu's generator (2 here; Next seed gives another warehouse of the same kind). The run seed fixes the random draws inside a run, such as the sensor noise and the particles. It is Vehicle → Random seed, 7 by default, and it takes effect on Reset. The people keep their routes when it changes, but the robot reaches them at other moments, so the encounters change too. The search seed, in Tools → Safety, fixes which worlds a search tries and how it perturbs the worst of them. Set the same seeds and you get the run a lesson quotes. One seed is one run, so the lessons also give the spread over several ("run seeds 1 to 5").</p>

## Try: Inside the domain: aisles of 2 m, four people
cfg: {"sim":true,"level":{"gen":"warehouse","seed":2,"like":"L5","aisle":2,"people":4},"tab":"mis"}
Setup: A generated warehouse inside ODD-1, with 2 m aisles, four people on straight walks, the busy floor's settings and five goals.
See: The robot reaches all five goals in 102 s. It has one contact with a person, a bump at 0.85 m/s at 25 s. It never touches a rack, and the wall clearance stays at 0.24 m or more. A person is within 2 m of the robot for 21.5 s of the 102.
Shows: Inside the domain the stack does its job, though not perfectly. On run seeds 1 to 5 it has one or two person contacts in each run, and over those five runs and this one it touches a rack once. Writing down a domain does not make the robot safe inside it. The domain says where the evidence is collected and where the claims will apply. Whether one bump in a hundred seconds is acceptable is the question for the next lesson.
Predict: Aisles of 2 m and four people, inside the domain. How many times does the robot touch a rack?
- None, or once at most
- Several times: the racks are close on both sides
- Every time it turns into an aisle
Answer: 0

## Try: Outside: aisles of 1.2 m
cfg: {"sim":true,"level":{"gen":"warehouse","seed":2,"like":"L5","aisle":1.2,"people":4},"tab":"mis"}
Setup: The same world with the aisles narrowed to 1.2 m. This moves one attribute across the boundary and leaves everything else as before.
See: The robot touches a rack twice, at 108 and 130 s. It has four person contacts, and three of them are strikes above 1 m/s. The wall clearance falls to 0.08 m, and the five goals take 147 s. At 23 s the planner reports that it found no path, and during the run the particle filter relocalizes 36 times.
Shows: On run seeds 1 to 5 the robot touches a rack three to five times, and two of those runs do not finish in 300 s. It does so because a 1.2 m aisle leaves the centred robot 0.3 m on each side, and this stack's position and tracking errors are about that size. In 2 m aisles it had 0.7 m on each side. The person contacts go up as well, because a narrow aisle leaves the robot no room to wait beside a person while they pass.
Predict: Narrow the aisles to 1.2 m and change nothing else. How many times does the robot touch a rack?
- Two or more
- None: 0.3 m a side is room enough
- Once, at the tightest turn
Answer: 0

## Try: Outside: eight people
cfg: {"sim":true,"level":{"gen":"warehouse","seed":2,"like":"L5","aisle":2,"people":8},"tab":"mis"}
Setup: The 2 m aisles again, now with eight people, which is twice the domain's limit.
See: There are three person contacts, at 25, 80 and 96 s, and one of them is a strike at 1.41 m/s. The robot also touches a rack once. The goals take 124 s. The table compares the time spent near a person with the run with four people:
| People | Closer than 0.3 m to a person (s) | Within 2 m of one (s) |
|---|---|---|
| four | 2.5 | 21.5 |
| eight | 8.6 | 45 |
Look at the 0.3 m column: with twice the people, the robot spends more than three times as long within 0.3 m of someone.
Shows: The number of people is a boundary too, and the harm grows faster than the count. Each extra person adds encounters, and each encounter in an aisle leaves the speed planner fewer gaps to wait for. On run seeds 1 to 5 the eight-person world has two to eight contacts in each run, against one or two with four people.
Predict: Double the people to eight, same world, same seed. How many person contacts compared with the four-person run?
- More
- The same: the speed planner handles each person on their own
- Fewer: the robot is slowed down so much it is harmless
Answer: 0

## Think about
Q: Which of ODD-1's attributes could the robot check for itself while it drives?
A: It could check the aisle width from its own map; the narrow world's "no path" at 23 s is such a check, made by accident. It could count the people and measure their speed from its tracks, tell how long the beacons have been silent, and notice fog from how few lidar beams come back. It cannot check the floor's grip until a wheel slips. Where the robot can check an attribute, a monitor can slow or stop it at the boundary. The other attributes have to be enforced by whoever puts the robot to work.
Q: Six runs inside the domain were fine, or nearly. Has the inside been shown safe?
A: No. Six runs of one generated world are six samples from a domain that holds infinitely many worlds. Later lessons search the domain for the worlds where the stack fails, and turn runs into a rate with a confidence bound. Until then, the claim that the robot is safe inside the domain has only a little evidence behind it.
Q: Fog moved the contacts on this world from one or two to between one and four depending on the seed. Should fog be inside the domain or outside?
A: Someone has to decide this; the measurement cannot. It only says that the stack does worse in fog and is less predictable there. Leaving fog out of the domain makes the claim easier to defend. It also makes the operator responsible for keeping the robot out of fog, and this stack cannot help them, because it does not notice fog (lesson 3).

## Check yourself
Q: The robot is 0.6 m across. In an aisle of 1.4 m, with the particle filter's position error at 0.15 m and the tracker's cross-track error at 0.1 m, how much margin is left on the worse side, in metres?
Answer: 0.15
Tolerance: 0.01
Unit: m
How: When the robot is centred, the margin is $m = (1.4 - 0.6)/2 = 0.4$ m on each side. Both errors can push the robot the same way, so on the worse side they add up to $0.15 + 0.1 = 0.25$ m. That leaves $0.4 - 0.25 = 0.15$ m.
