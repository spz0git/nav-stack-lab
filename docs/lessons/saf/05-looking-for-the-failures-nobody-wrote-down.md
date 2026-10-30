group: saf
title: Looking for the failures nobody wrote down

<p><b>Why this matters.</b> Lesson 3 listed the triggering conditions someone had already noticed. The ones that matter most are the ones nobody has: the situation no designer imagined, which the robot meets on its third day in a new warehouse. You cannot list those, but you can look for them, and a simulator that runs a mission in a couple of seconds can look harder than any test track. This lesson runs that search over the busy floor's operating domain: worlds sampled at random from the domain, then more worlds near the worst of them, and every failure it finds opened, watched and filed as known or new.</p>
<p><b>In the standards.</b> ISO 21448 asks for two kinds of testing before the robot goes to work: rerun the triggering conditions already known, to check that the fixes hold, and go looking for the ones nobody knows. Only with both can anyone judge how much risk is left. UL 4600 adds that a big pile of runs proves nothing by itself: the safety case has to show that the runs reached every part of the domain, the narrow, crowded aisles included. The standards are introduced in <a class="chref" href="#notes=ch8/1-the-four-standards-in-the-lab-s-words">chapter 8 §1</a>.</p>
<p><b>The idea.</b> A scenario is one world drawn from the domain together with one run of the robot in it. The world is a generated warehouse, fixed by its world seed, its aisle width and its number of people. The scenario adds the weather, whether the people react to the robot, and the run seed.</p>
<p>To compare runs, the search gives each one a single number, its margin, and lower is worse. A run that ended in a contact gets minus the speed of its fastest contact: a strike at 1.3 m/s gives a margin of −1.3. A run with no contact gets the closest it came to a person or a rack: if it never came nearer than 0.4 m, its margin is +0.4. A negative margin is therefore a contact and a small positive one a near miss. Sort the runs by margin and the worst come first.</p>
<p>A search spends its budget of runs in two halves. In the first half it draws worlds at random from the whole domain, each setting anywhere in its range, and runs each one. This half gives a rough idea of how much of the domain fails. In the second half it looks where the failures are. It takes the worst runs found so far (the worst tenth, and at least three of them), nudges each of their settings a little, a slightly narrower aisle or one person more, and runs the nudged scenarios. It keeps each world's seed, so the racks and the people's routes stay as they were, and keeps the run seed half the time. The next round nudges by half as much, around the worst runs so far. Every random choice the search makes, which worlds it draws and how it nudges them, comes from one number, the search seed: the same search seed on the same sheet gives the same 40 runs again.</p>
<p>In symbols, the margin and the nudge are as follows. Write $v_{rel,c}$ for the speed of contact $c$, the robot's speed relative to what it hit, and $g_{person}$ and $g_{rack}$ for the run's smallest gaps to a person and to a rack. Then</p>
$$m = \begin{cases} -\max_c v_{rel,c} & \text{if the run had a contact} \\ \min(g_{person},\, g_{rack}) & \text{otherwise} \end{cases}$$
<p>A setting $x$ whose range runs from lo to hi is nudged by a random share $\delta$ of that range, drawn evenly between $-f$ and $f$, and kept inside the range. The step $f$ is 0.25 in the first round and 0.125 in the second:</p>
$$x' = \mathrm{clip}\bigl(x + \delta\,(\text{hi} - \text{lo}),\ \text{lo},\ \text{hi}\bigr), \qquad \delta \sim U(-f, f)$$
<p>Why the second half finds more failures for the same number of runs: where the stack is good, failures are rare, and most random draws land there. Near a run that failed, most of what made it fail is still there, so a nudged copy is much more likely to fail too. Each failure the search finds is then filed. A failure of a known kind is a new instance of a row in lesson 3's table; one of a new kind is a new row, an unknown-unsafe situation made known.</p>
<p><b>Where it comes from.</b> The margin, the sampling and the refinement, the measured searches at three search seeds, and why the counts, not the single worst run, are what to compare: <a class="chref" href="#notes=ch8/7-searching-the-domain">chapter 8 §7</a>.</p>
<p><b>What the lab does.</b> The search lives in the Safety tab, one of the Tools in the settings panel: switch to Simulate and it is on the right (on a phone, press Settings at the bottom). From the top, this is what you meet there.</p>
<p>First the sheet, under the heading "Operating domain: ODD-1, the busy floor". It is a table of the domain's ranges: Aisles from 2 to 3.2 m, People from 0 to 4, People who wait for the robot from 0 to 0, then boxes for the weather (only clear is ticked) and the kind of people (only scripted). You can change any of them, and "Back to ODD-1" puts the sheet back.</p>
<p>Under the heading "Search" are the size of the search (Runs 40, Refine rounds 2, Search seed 1) and the Search button. Search starts the runs in up to four background workers, which leave the simulator alone: the map stays still the whole time. Beside the button a counter shows how many runs are done ("12/40 · sampling the domain", later "refining around the worst"), and a bar fills under it.</p>
<p>When the random half is done, a chart appears with one dot per run. The dot's height is the run's margin. Blue dots are the random half and rose dots the refined half, and a dot below the zero line is a run with a contact. Under the chart, a table lists the eight worst runs: the margin, what happened (a strike at 1.34 m/s and when, for instance) and the scenario (the world seed, the aisle width, the people, the run seed). Each row has an Open button. It loads that world and that run into the simulator, paused, so that you can press Run and watch what happened.</p>
<p>The button "Keep the worst 5 as a set" saves those five scenarios under "Scenario sets". A set's Rerun button runs the same five again with whatever you have changed since, the safety stop for instance, and says how many of them now finish without a contact. That is how a change is checked against every scenario, not only against the one that prompted it.</p>
<p>Each search Try below starts a search of 40 runs at search seed 1, which takes a minute or so (longer on a phone). While you stay in Learn, its progress shows under the Try button and in the event log. For the maintainer, the same search runs without the page as <code>node tools/search.mjs --seed 1</code>.</p>

## Try: Search the busy floor's domain
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":"ODD-1","budget":40,"rounds":2,"seed":1,"run":true}}
Setup: The button opens the Safety tab in the settings panel and starts the search, which runs in the background for a minute or so; its progress shows under this button and in the event log, and the simulator stays still until you press Open on one of the runs the tab lists. ODD-1: generated warehouses of 24 × 16 m with aisles of 2 to 3.2 m and up to four scripted people, clear air, the busy floor's settings. Twenty runs at random, then two rounds of ten near the worst.
See: Runs with a contact, of 20 in each half:
| Search seed | Random runs | Refined runs |
|---|---|---|
| 1 (this search) | 8, two of them a strike | 10, seven of them a strike |
| 2 | 9 | 14 |
| 3 | 8 | 12 |
Compare the columns: the refined half finds more on every search seed. The worst margin is −1.34, a strike at 1.34 m/s.
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
Setup: The same search with up to three people who stand still until the robot comes within 3 m of their route's middle, then walk briskly: people who step out of a doorway or from behind a rack as the robot arrives, which ODD-1 never described. As in the first experiment, the search runs in the background for a minute or so, with its progress under this button and in the event log; the simulator stays still until you press Open on a run in the Safety tab.
See: Without the people who wait, eight of the 20 random runs had a contact, two of them a strike. With them:
| Search seed | Random runs with a contact, of 20 | Worst margin |
|---|---|---|
| 1 (this search) | 14, eight of them a strike | −1.85 |
| 2 | 15 | below −1.7 |
| 3 | 11 | below −1.7 |
Look at the worst margin: below −1.7 on all three search seeds.
Shows: An element nobody wrote into the domain, found by widening the sheet and searching: the unknown-unsafe made known. Whether it belongs inside the domain is a decision for the safety case; the search's job was to show what it costs.
Predict: Add people who wait for the robot. How many of the 20 random runs have a contact, against eight without them?
- More
- About the same: they are only three more people
- Fewer: they stand still most of the time
Answer: 0

## Try: The same domain with the safety stop on
cfg: {"sim":true,"level":4,"set":{"guard":true},"tab":"saf","hold":true,"saf":{"sheet":"ODD-1","budget":40,"rounds":2,"seed":1,"run":true}}
Setup: ODD-1 again, search seed 1, with the lidar safety stop on (it is in the settings the search adds to every run: the note at the top of the tab lists them). The random half is the same 20 scenarios as the first experiment. The search again runs in the background for a minute or so, with its progress under this button and in the event log.
See: Random runs with a contact, of 20:
| Search seed | Without the stop | With the stop |
|---|---|---|
| 1 (this search) | 8 | 6 |
| 2 | 9 | 6 |
| 3 | 8 | 5 |
Fewer on every search seed, but not run by run: at search seed 1, six scenarios are better than without the stop and two are worse. The refinement still finds contacts: 13 of its 20 runs.
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
