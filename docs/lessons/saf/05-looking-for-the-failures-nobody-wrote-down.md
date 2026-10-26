group: saf
title: Looking for the failures nobody wrote down

<p><b>Why this matters.</b> Lesson 3 listed the triggering conditions someone had already noticed. The ones that matter most are the ones nobody has: the situation no designer imagined, which the robot meets on its third day in a new warehouse. You cannot list those, but you can look for them, and a simulator that runs a mission in a couple of seconds can look harder than any test track. This lesson runs that search over the busy floor's operating domain: worlds sampled at random from the domain, then more worlds near the worst of them, and every failure it finds opened, watched and filed as known or new.</p>
<p><b>The standards.</b> ISO 21448 sets a verification and validation strategy (clause 9), evaluates the known scenarios (clause 10) and searches for unknown ones (clause 11), and judges from both what risk remains (clause 12). UL 4600 (clause 12) asks that the testing be argued to cover the domain, not merely be large. The lab paraphrases the standards and quotes none of them. The clause numbers are the best available from public outlines (ISO 26262:2018, ISO 21448:2022, ISO/PAS 8800:2024, UL 4600 third edition (2023)) and have not been checked against the texts.</p>
<p><b>The idea.</b> A scenario is a point in the domain: a generated world (its seed, the aisle width, the number of people), the weather, the people's behaviour and the run's seed. Each run gets a margin $m$, lower being worse: minus the speed of its fastest contact if it had one, else the smallest gap to a person or a rack. Random sampling estimates how much of the domain fails; refinement looks near the worst runs found so far, perturbing each range by a step that shrinks every round:</p>
$$m = \begin{cases} -\max_c v_{rel,c} & \text{a contact} \\ \min(g_{person},\, g_{rack}) & \text{otherwise} \end{cases} \qquad x' = \mathrm{clip}\bigl(x + \delta\,(\text{hi} - \text{lo}),\ \text{lo},\ \text{hi}\bigr),\ \ \delta \sim U(-f, f)$$
<p>Failures are rare where the stack is good and common where it is not, so a search that follows them finds more for the same budget. What it finds is then sorted: a failure of a known kind is a new instance of a row in lesson 3's table; one of a new kind is a new row, an unknown-unsafe situation made known.</p>
<p><b>Where it comes from.</b> The margin, the sampling and the refinement, the measured searches at three search seeds, and why the counts, not the single worst run, are what to compare: <a class="chref" href="#notes=ch8/7-searching-the-domain">chapter 8 §7</a>.</p>
<p><b>What the lab does.</b> Tools → Safety: the domain as a sheet of ranges, a Search button, a chart of every run's margin (blue the random runs, rose the refined ones, below zero a contact), and the worst runs, each with an Open button that sets it up in the simulator. "Keep the worst 5 as a set" saves them; Rerun runs the set again with whatever you have changed since, the safety stop for instance. The Try buttons start a search of 40 runs with search seed 1, which takes about a minute in up to four background workers; the same search in Node is <code>node tools/search.mjs --seed 1</code>.</p>

## Try: Search the busy floor's domain
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":"ODD-1","budget":40,"rounds":2,"seed":1,"run":true}}
Setup: ODD-1: generated warehouses of 24 × 16 m with aisles of 2 to 3.2 m and up to four scripted people, clear air, the busy floor's settings. Twenty runs at random, then two rounds of ten near the worst.
See: Eight of the 20 random runs have a contact, two of them a strike. Ten of the 20 refined runs have one, seven of them a strike; the worst margin is −1.34, a strike at 1.34 m/s. At search seeds 2 and 3 the random runs have a contact in 9 and 8 of 20, the refined ones in 14 and 12.
Shows: Inside its own domain the stack touches someone in about two runs in five: lesson 1's one world was not typical. And the refinement earns its keep: on the same budget it turns up more failures than sampling at random, and at search seeds 1 and 3 more strikes too, because it spends its runs where the failures are.
Predict: Twenty runs at random, then twenty near the worst. Which half has more runs with a contact?
- The refined half
- The random half: it covers more of the domain
- About the same: a contact is a contact
Answer: 0

## Try: The worst run, opened
cfg: {"sim":true,"level":{"gen":"warehouse","seed":4374,"w":24,"h":16,"goals":5,"people":3,"stepout":0,"beacons":0,"aisle":2,"depth":0.8,"cross":1,"gaps":0.2,"like":"L5"},"set":{"weather":"clear","people":"scripted"},"seed":86,"tab":"ctl","layers":{"agents":true}}
Setup: The worst run of that search, as its Open button sets it up: world 4374, aisles of 2 m, three people, run seed 86.
See: A person pauses at the end of their walk, then turns back down the 2 m aisle straight at the robot. The speed planner yields at 18 s; at 20.5 s it reports that the person blocks the path and asks for a new one, which comes a second too late: a strike at 21.5 s, 1.34 m/s.
Shows: A known kind of failure in a new place: lesson 3's person turning back at the end of their walk, here head-on in a narrow aisle with no way round. Filed as a new instance of a known row, it adds a scenario to that row's regression set; a fix for the turn-back has to pass it too.
Predict: Which of lesson 3's triggering conditions is this?
- A person turning back at the end of their walk
- Fog
- A person inside the sonar's dead zone
Answer: 0

## Try: A wider domain: people who wait for the robot
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":{"name":"ODD-1 with people who wait","family":"warehouse","like":"L5","w":24,"h":16,"ranges":{"aisle":[2,3.2],"people":[0,4],"stepout":[0,3]},"weather":["clear"],"people":["scripted"]},"budget":40,"rounds":2,"seed":1,"run":true}}
Setup: The same search with up to three people who stand still until the robot comes within 3 m of their route's middle, then walk briskly: people who step out of a doorway or from behind a rack as the robot arrives, which ODD-1 never described.
See: Fourteen of the 20 random runs have a contact, eight of them a strike, against eight and two without them; the worst margin falls to −1.85. At search seeds 2 and 3, 15 and 11 random runs of 20 have a contact, and the worst margin is below −1.7 on all three.
Shows: An element nobody wrote into the domain, found by widening the sheet and searching: the unknown-unsafe made known. Whether it belongs inside the domain is a decision for the safety case; the search's job was to show what it costs.
Predict: Add people who wait for the robot. How many of the 20 random runs have a contact, against eight without them?
- More
- About the same: they are only three more people
- Fewer: they stand still most of the time
Answer: 0

## Try: The same domain with the safety stop on
cfg: {"sim":true,"level":4,"set":{"guard":true},"tab":"saf","hold":true,"saf":{"sheet":"ODD-1","budget":40,"rounds":2,"seed":1,"run":true}}
Setup: ODD-1 again, search seed 1, with the lidar safety stop on (it is in the settings the search adds to every run: the note at the top of the tab lists them). The random half is the same 20 scenarios as the first experiment.
See: Six of the 20 random runs have a contact instead of eight. Run by run, six scenarios are better than without the stop and two are worse. The refinement still finds contacts: 13 of its 20 runs. At search seeds 2 and 3 the random runs with a contact go from 9 to 6 and from 8 to 5.
Shows: A mitigation judged against a set, not a story: it helps on most scenarios and hurts on some, which only shows when every scenario is rerun. That is what a scenario set is for, and why the change that fixed the motivating case is rerun against all of them before it is accepted.
Predict: The same 20 random scenarios with the safety stop on. Runs with a contact?
- Fewer
- The same: the stop only slows the robot down
- More: the stops put the robot in the people's way
Answer: 0

## Think about
Q: Forty runs found contacts in about two of every five worlds of the domain. Is that the stack's failure rate?
A: Not as it stands. The random half estimates the share of worlds with a contact, with wide error bars at 20 runs; the refined half is biased towards failures on purpose and says nothing about the rate. And a share of worlds is not a rate per hour of work: that needs how often each kind of world occurs and how long the robot spends in it, which is lesson 8's question.
Q: Refinement's worst run was not always worse than the random half's worst. Why compare counts instead?
A: The single worst run is one sample of a noisy extreme: with a different search seed the random half can stumble on a bad world the refinement never visits. The number of failures found for the same budget is far steadier, and it is what a search is for: finding many failures to learn from, not one.
Q: The safety stop made two scenarios worse. What could make a safety function cause harm?
A: Stopping where a person is about to walk: the stop holds the robot in the person's path, and a scripted person walks into it, or the stop's sudden halt changes the timing so the robot meets another person it would have passed. A mitigation changes the whole trajectory, not just the moment it acts, which is why it is checked on the whole set.

## Check yourself
Q: The random half of a search found a contact in 8 of 20 runs. Using a simple proportion, what share of the domain's worlds has a contact, in percent?
Answer: 40
Tolerance: 0.5
Unit: %
How: $8 / 20 = 0.40$, 40 %; with 20 runs the 95 % interval is roughly 19 % to 64 %, which is why a search to estimate a rate needs many more runs.
