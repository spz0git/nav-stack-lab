group: saf
title: Looking for the failures nobody wrote down

<p><b>Why this matters.</b> Lesson 3 listed the triggering conditions someone had already noticed. The ones that matter most are the ones nobody has noticed yet, such as a situation no designer imagined that the robot meets on its third day in a new warehouse. You cannot list those, but you can look for them. A simulator that runs a mission in a couple of seconds can try far more situations than any test track. In this lesson you run that search over the busy floor's operating domain. The search first samples worlds at random from the domain, then tries more worlds near the worst of them. You then open each failure it finds, watch it, and file it as a known kind or a new one.</p>
<p><b>In the standards.</b> ISO 21448 asks for two kinds of testing before the robot goes to work. One reruns the triggering conditions already known, to check that the fixes hold. The other goes looking for the ones nobody knows. Only with both can anyone judge how much risk is left. UL 4600 adds that a large number of runs is not enough on its own. The safety case has to show that the runs reached every part of the domain, including the narrow, crowded aisles. The standards are introduced in <a class="chref" href="#notes=ch8/1-the-four-standards-in-the-lab-s-words">chapter 8 §1</a>.</p>
<p><b>The idea.</b> A scenario is one world drawn from the domain together with one run of the robot in it. The world is a generated warehouse, fixed by its world seed, its aisle width and its number of people. The scenario adds the weather, whether the people react to the robot, and the run seed.</p>
<p>To compare runs, the search gives each one a single number, its margin, and lower is worse. A run that ended in a contact gets minus the speed of its fastest contact: a strike at 1.3 m/s gives a margin of −1.3. A run with no contact gets the closest it came to a person or a rack: if it never came nearer than 0.4 m, its margin is +0.4. A negative margin is therefore a contact and a small positive one a near miss. Sort the runs by margin and the worst come first.</p>
<p>A search spends its budget of runs in two halves. In the first half it draws worlds at random from the whole domain, each setting anywhere in its range, and runs each one. This half gives a rough idea of how much of the domain fails. In the second half it looks where the failures are. It takes the worst runs found so far (the worst tenth, and at least three of them). It nudges each of their settings a little, to a slightly narrower aisle or one person more, and runs the nudged scenarios. It keeps each world's seed, so the racks and the people's routes stay as they were, and it keeps the run seed half the time. The next round nudges by half as much, around the worst runs so far. Every random choice the search makes, which worlds it draws and how it nudges them, comes from one number, the search seed. The same search seed on the same sheet gives the same 40 runs again.</p>
<p>In symbols, the margin and the nudge are as follows. Write $v_{rel,c}$ for the speed of contact $c$, the robot's speed relative to what it hit, and $g_{person}$ and $g_{rack}$ for the run's smallest gaps to a person and to a rack. Then</p>
$$m = \begin{cases} -\max_c v_{rel,c} & \text{if the run had a contact} \\ \min(g_{person},\, g_{rack}) & \text{otherwise} \end{cases}$$
<p>A setting $x$ whose range runs from lo to hi is nudged by a random share $\delta$ of that range, drawn evenly between $-f$ and $f$, and kept inside the range. The step $f$ is 0.25 in the first round and 0.125 in the second:</p>
$$x' = \mathrm{clip}\bigl(x + \delta\,(\text{hi} - \text{lo}),\ \text{lo},\ \text{hi}\bigr), \qquad \delta \sim U(-f, f)$$
<p>The second half finds more failures for the same number of runs. Where the stack is good, failures are rare, and most random draws land there. Near a run that failed, most of what made it fail is still there, so a nudged copy is much more likely to fail too. Each failure the search finds is then filed. A failure of a known kind is a new instance of a row in lesson 3's table. A failure of a new kind is a new row: an unknown-unsafe situation that is now known.</p>
<p><b>Where it comes from.</b> The margin, the sampling and the refinement, and the measured searches at three search seeds are in <a class="chref" href="#notes=ch8/7-searching-the-domain">chapter 8 §7</a>. The chapter also explains why you compare the number of failures found and not the single worst run.</p>
<p><b>What the lab does.</b> Each search Try in this lesson shows its result under its own button: the progress while it runs, then the five worst runs, each with an Open button. The whole search lives in the Safety tab, one of the Tools in the settings panel. The button under a Try's result takes you there, or switch to Simulate and it is on the right (on a phone, press Settings at the bottom). From the top, this is what you meet there.</p>
<p>First the sheet, under the heading "Operating domain: ODD-1, the busy floor". It is a table of the domain's ranges: Aisles from 2 to 3.2 m, People from 0 to 4, People who wait for the robot from 0 to 0, then boxes for the weather (only clear is ticked) and the kind of people (only scripted). You can change any of them, and "Back to ODD-1" puts the sheet back.</p>
<p>Under the heading "Search" are the size of the search (Runs 40, Refine rounds 2, Search seed 1) and the Search button. Search starts the runs in up to four background workers, which leave the simulator alone: the map stays still the whole time. Beside the button a counter shows how many runs are done ("12/40 · sampling the domain", later "refining around the worst"), and a bar fills under it.</p>
<p>When the random half is done, a chart appears with one dot per run. The dot's height is the run's margin. Blue dots are the random half and rose dots the refined half, and a dot below the zero line is a run with a contact. Under the chart, a table lists the eight worst runs: the margin, what happened (a strike at 1.34 m/s and when, for instance) and the scenario (the world seed, the aisle width, the people, the run seed). Each row has an Open button. It loads that world and that run into the simulator and plays it from 3 s before its fastest contact, with Pause on contact ticked, so it stops at the moment of the contact. A run without a contact is loaded paused at the start, and Run plays it.</p>
<p>The button "Keep the worst 5 as a set" saves those five scenarios under "Scenario sets". A set's Rerun button runs the same five again with whatever you have changed since, the safety stop for instance, and says how many of them now finish without a contact. This is how you check a change against every scenario in the set, as well as against the one that prompted it.</p>
<p>Each search Try below starts a search of 40 runs at search seed 1, which takes a minute or so (longer on a phone). While you stay in Learn, its progress shows under the Try button and in the event log, and when it is done the five worst runs are listed there with their Open buttons. For the maintainer, the same search runs without the page as <code>node tools/search.mjs --seed 1</code>.</p>

## Try: Search the busy floor's domain
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":"ODD-1","budget":40,"rounds":2,"seed":1,"run":true}}
Setup: The button opens the Safety tab in the settings panel and starts the search. The search runs in the background for a minute or so, and its progress shows under this button and in the event log. When it is done, its five worst runs are listed under this button. The simulator stays still until you press Open on one of them. The sheet is ODD-1: generated warehouses of 24 × 16 m with aisles of 2 to 3.2 m, up to four scripted people, clear air and the busy floor's settings. The search makes twenty runs at random, then two rounds of ten near the worst.
See: Runs with a contact, of 20 in each half:
| Search seed | Random runs | Refined runs |
|---|---|---|
| 1 (this search) | 8, two of them a strike | 10, seven of them a strike |
| 2 | 9 | 14 |
| 3 | 8 | 12 |
Compare the two columns. The refined half finds more on every search seed. The worst margin is −1.34, a strike at 1.34 m/s.
Shows: Inside its own domain the stack touches someone in about two runs in five, so lesson 1's one world was not typical. With the same number of runs, the refinement finds more failures than sampling at random, and at search seeds 1 and 3 it finds more strikes as well. It does so because it spends its runs where the failures are.
Predict: Twenty runs at random, then twenty near the worst. Which half has more runs with a contact?
- The refined half
- The random half: it covers more of the domain
- About the same: a contact is a contact
Answer: 0

## Try: The worst run, opened
cfg: {"sim":true,"level":{"gen":"warehouse","seed":4374,"w":24,"h":16,"goals":5,"people":3,"stepout":0,"beacons":0,"aisle":2,"depth":0.8,"cross":1,"gaps":0.2,"like":"L5"},"set":{"weather":"clear","people":"scripted"},"seed":86,"tab":"ctl","layers":{"agents":true}}
Setup: The worst run of that search, as its Open button sets it up: world 4374, aisles of 2 m, three people, run seed 86.
See: A person pauses at the end of their walk, then turns back down the 2 m aisle straight at the robot. The speed planner yields at 18 s. At 20.5 s it reports that the person blocks the path, and asks for a new one. The new path comes a second too late, and there is a strike at 1.34 m/s at 21.5 s.
Shows: This is a known kind of failure in a new place. It is lesson 3's person turning back at the end of their walk, here head-on in a narrow aisle with no way round. You file it as a new instance of that known row, and it joins the row's regression set. Any fix for the turn-back then has to pass this scenario too.
Predict: Which of lesson 3's triggering conditions is this?
- A person turning back at the end of their walk
- Fog
- A person inside the sonar's dead zone
Answer: 0

## Try: A wider domain: people who wait for the robot
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":{"name":"ODD-1 with people who wait","family":"warehouse","like":"L5","w":24,"h":16,"ranges":{"aisle":[2,3.2],"people":[0,4],"stepout":[0,3]},"weather":["clear"],"people":["scripted"]},"budget":40,"rounds":2,"seed":1,"run":true}}
Setup: The same search, with up to three people added who stand still until the robot comes within 3 m of the middle of their route, and then walk briskly. They are people who step out of a doorway or from behind a rack just as the robot arrives, and ODD-1 never described them. As in the first experiment, the search runs in the background for a minute or so, with its progress under this button and in the event log. The simulator stays still until you press Open on a run in the Safety tab.
See: Without the people who wait, eight of the 20 random runs had a contact, two of them a strike. With them:
| Search seed | Random runs with a contact, of 20 | Worst margin |
|---|---|---|
| 1 (this search) | 14, eight of them a strike | −1.85 |
| 2 | 15 | below −1.7 |
| 3 | 11 | below −1.7 |
Look at the worst margin. It is below −1.7 on all three search seeds.
Shows: Nobody wrote these people into the domain. Widening the sheet and searching showed the failures they cause, so an unknown-unsafe situation is now known. Whether they belong inside the domain is for the safety case to decide. The search shows what including them would cost.
Predict: Add people who wait for the robot. How many of the 20 random runs have a contact, against eight without them?
- More
- About the same: they are only three more people
- Fewer: they stand still most of the time
Answer: 0

## Try: The same domain with the safety stop on
cfg: {"sim":true,"level":4,"set":{"guard":true},"tab":"saf","hold":true,"saf":{"sheet":"ODD-1","budget":40,"rounds":2,"seed":1,"run":true}}
Setup: ODD-1 again at search seed 1, with the lidar safety stop on. The stop is one of the settings the search adds to every run, which the note at the top of the tab lists. The random half is the same 20 scenarios as in the first experiment. The search again runs in the background for a minute or so, with its progress under this button and in the event log.
See: Random runs with a contact, of 20:
| Search seed | Without the stop | With the stop |
|---|---|---|
| 1 (this search) | 8 | 6 |
| 2 | 9 | 6 |
| 3 | 8 | 5 |
There are fewer on every search seed, but not every scenario improves. At search seed 1, six scenarios are better than without the stop and two are worse. The refinement still finds contacts, in 13 of its 20 runs.
Shows: The safety stop helps on most scenarios and makes some worse. You only see that when you rerun every scenario; a single example could show either. A scenario set is kept for this. Before a change is accepted, it is rerun against every scenario in the set as well as the one it was made to fix.
Predict: The same 20 random scenarios with the safety stop on. Runs with a contact?
- Fewer
- The same: the stop only slows the robot down
- More: the stops put the robot in the people's way
Answer: 0

## Think about
Q: Forty runs found contacts in about two of every five worlds of the domain. Is that the stack's failure rate?
A: Not yet. The random half estimates the share of worlds with a contact, and at 20 runs the error bars are wide. The refined half is biased towards failures on purpose, so it says nothing about the rate. A share of worlds is also different from a rate per hour of work. To get a rate you need to know how often each kind of world occurs and how long the robot spends in it, which is the question of lesson 8.
Q: Refinement's worst run was not always worse than the random half's worst. Why compare counts instead?
A: The single worst run is one sample from the far end of a noisy spread. With a different search seed, the random half can happen on a bad world that the refinement never visits. The number of failures found with the same number of runs is far steadier. It is also what the search is for, since each failure found is one more to learn from.
Q: The safety stop made two scenarios worse. What could make a safety function cause harm?
A: The stop can hold the robot where a person is about to walk, and a scripted person then walks into it. Or the sudden halt changes the timing, so the robot meets another person it would otherwise have passed. A mitigation changes the rest of the run after the moment it acts, so it has to be checked on the whole set.

## Check yourself
Q: The random half of a search found a contact in 8 of 20 runs. Using a simple proportion, what share of the domain's worlds has a contact, in percent?
Answer: 40
Tolerance: 0.5
Unit: %
How: $8 / 20 = 0.40$, which is 40 %. With 20 runs the 95 % interval is roughly 19 % to 64 %, so a search meant to estimate a rate needs many more runs.
