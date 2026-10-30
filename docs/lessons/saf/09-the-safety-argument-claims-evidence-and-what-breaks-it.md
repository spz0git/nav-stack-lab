group: saf
title: The safety argument: claims, evidence, and what breaks it

<p><b>Why this matters.</b> Eight lessons produced evidence: runs, searches, rates, monitors. A safety case is what turns evidence into a claim someone can sign: this robot is acceptably safe here, because of this, and this, and this. Written down, the argument shows what each piece of evidence is for, what the claim leans on that nobody tested, and, when something changes, exactly which part of the case it breaks. Kept live, with every piece of evidence a run that can be repeated, it stops being a document finished once and becomes something the team maintains as the robot, its software and its floor change.</p>
<p><b>In the standards.</b> UL 4600 is built around the safety case: it judges a robot by its argument, claims backed by evidence, rather than by a fixed list of tests, and it wants the argument kept current. ISO 26262 asks for a safety case too, and ISO/PAS 8800 for one that covers the learned blocks. None of them says how to draw it; Goal Structuring Notation (GSN) is the common way, and the lab uses it as a notation only. Where the safety case sits among the four standards: <a class="chref" href="#notes=ch8/1-the-four-standards-in-the-lab-s-words">chapter 8 §1</a>.</p>
<p><b>The idea.</b> A goal is a claim. A strategy says how a goal is broken into smaller ones; a solution is the evidence for a goal; context, assumptions and justifications are what a goal leans on, drawn beside it. A goal is supported when everything under it is, so the argument is a logical AND down the tree:</p>
$$\text{supported}(G) = \bigwedge_{c\,\in\,\text{support}(G)} \text{supported}(c), \qquad \text{supported}(E) = \bigl[\,m(E) \;\mathrm{op}\; v(E)\,\bigr]$$
<p>with $m(E)$ the metric a solution's runs measure and $v(E)$ its bound. One failed solution turns every claim above it red. An assumption is the opposite of evidence: something the claim needs that nobody measured. A <i>defeater</i> is a reason the claim might be false that the argument does not address; finding defeaters is how an argument gets better.</p>
<p><b>Where it comes from.</b> The format, how evidence is run and judged, the ODD monitor's observables and their thresholds, and the measured verdicts: <a class="chref" href="#notes=ch8/11-the-safety-argument-and-the-odd-monitor">chapter 8 §11</a>.</p>
<p><b>What the lab does.</b> Tools → Safety → Safety argument: ARG-1, the busy floor within ODD-1 with people who give way, drawn in GSN (goals as boxes, the strategy as a parallelogram, solutions as ellipses, context as rounded boxes, assumptions and justifications as dashed ellipses marked A and J), and Check the evidence, which reruns every solution in the background workers, the runs that two solutions share once, and colours each node: green supported, red not. <i>Changes for every run</i> adds settings to every one of them. Open the graph full width to see all of it. Pick a node to edit it, add a node under it, or remove it; your arguments, sheets and scenario sets stay in this browser, save as JSON, and travel in a link. Mission → <i>ODD monitor</i> watches what the robot can see of its domain: whether the air is clear, from the lidar's return share over 2 s, and whether a learned block reads inputs unlike its training data; outside for 1 s, it crawls at 0.3 m/s or stops. Each Try checks the argument: 47 runs, about a minute and a half (the last, with a second search, about three).</p>

## Try: Check the argument
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"arg":"ARG-1","argSet":{},"check":true}}
Setup: ARG-1 as it stands. Four claims under one strategy: no contact with a person in the known scenarios (the busy floor at six seeds), no strike in a 40-run search of the domain, no contact with a rack above 0.3 m/s (the same six runs), and fog noticed within 2 s by the ODD monitor.
See: Three claims green: no contact with a person in the six runs, no strike in the 40, fog noticed at 1.95 s. The rack claim is red: on seed 3 the robot hits a rack at 0.52 m/s at 56.8 s, a bump. So the strategy is red, and the top claim is not supported.
Shows: The argument does what a list of test results does not: it says that the robot is not yet shown to be safe, and exactly why. The red path runs from one solution to the top; everything else holds. The fix belongs to the rack claim (a slower approach near racks, more clearance), and once made, the whole argument is rerun, not only that leaf.
Predict: Is the top claim supported?
- No: the rack claim's evidence fails
- Yes: no person is ever touched
- No: the search finds strikes
Answer: 0

## Try: People who don't give way
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"arg":"ARG-1","argSet":{"people":"scripted"},"check":true}}
Setup: The same argument with one change for every run: the people walk their routes without reacting to the robot, which breaks assumption A1.
See: Both claims about people go red: 7 contacts in the six runs, 11 strikes in the search. The rack claim turns green: with these people the robot never touches a rack. The fog claim stays green.
Shows: The assumption was carrying the case. Nothing in the evidence tested it; changing it moves half the argument. And a claim can pass for the wrong reason: the rack claim now holds only because the people's paths changed the robot's, which is why an argument is rerun whole after every change and not leaf by leaf.
Predict: People stop giving way. Which claims fail?
- The two about people; the rack claim now passes
- Every claim fails
- Only the search for strikes
Answer: 0

## Try: The monitor switched off
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"arg":"ARG-1","argSet":{"oddMon":false},"check":true}}
Setup: ARG-1 with the ODD monitor off in every run, as if a configuration change had dropped it.
See: The fog claim goes red: the robot never notices it has left its domain. The claims about people stay green, and the rack claim stays red as before.
Shows: A safety mechanism is part of the case only while something checks that it is there and works. A configuration slip that leaves every test about people green would still remove the one thing that knows when the robot is outside the conditions those tests were run in. The live argument catches it on the next check; a document would not.
Predict: The monitor is switched off. Which claim fails that passed before?
- The one about noticing fog
- The one about people in the known scenarios
- None: the monitor only acts in fog
Answer: 0

## Try: A defeater: people who step out
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"arg":{"format":"nav-stack-lab-argument","version":1,"name":"ARG-1 with a defeater: people who step out","nodes":[{"id":"G1","type":"goal","text":"The robot is acceptably safe on the busy floor, within ODD-1 with people who give way"},{"id":"C1","type":"context","parent":"G1","rel":"context","text":"ODD-1: generated warehouses, aisles of 2 to 3.2 m, up to four people, clear air"},{"id":"C2","type":"context","parent":"G1","rel":"context","text":"Hazards (lesson 2): striking or bumping a person, hitting a rack"},{"id":"A1","type":"assumption","parent":"G1","rel":"context","text":"People give way to the robot"},{"id":"S1","type":"strategy","parent":"G1","rel":"support","text":"Argue over each hazard, then over leaving the domain"},{"id":"G2","type":"goal","parent":"S1","rel":"support","text":"No contact with a person in the known scenarios"},{"id":"E1","type":"solution","parent":"G2","rel":"support","text":"The busy floor, people giving way, seeds 7 and 1 to 5: no contact with the robot moving","evidence":{"kind":"runs","level":4,"set":{"people":"reactive"},"seeds":[7,1,2,3,4,5],"metric":"contacts","op":"<=","value":0}},{"id":"G3","type":"goal","parent":"S1","rel":"support","text":"A search of the domain finds no strike"},{"id":"E2","type":"solution","parent":"G3","rel":"support","text":"40 random worlds of ODD-1 with people giving way, search seed 1: no strike","evidence":{"kind":"search","sheet":"ODD-1","set":{"people":"reactive"},"budget":40,"seed":1,"metric":"strikes","op":"<=","value":0}},{"id":"J1","type":"justification","parent":"G3","rel":"context","text":"About 1.3 h without a strike bounds the rate below 3 per hour (the rule of three); it does not show it is zero"},{"id":"G4","type":"goal","parent":"S1","rel":"support","text":"No contact with a rack above 0.3 m/s"},{"id":"E3","type":"solution","parent":"G4","rel":"support","text":"The same six runs: the fastest contact with a rack at most 0.3 m/s","evidence":{"kind":"runs","level":4,"set":{"people":"reactive"},"seeds":[7,1,2,3,4,5],"metric":"rackSpeed","op":"<=","value":0.3}},{"id":"G5","type":"goal","parent":"S1","rel":"support","text":"The robot notices fog, outside its domain, within 2 s"},{"id":"E4","type":"solution","parent":"G5","rel":"support","text":"The busy floor in fog with the ODD monitor: outside within 2 s","evidence":{"kind":"runs","level":4,"set":{"people":"reactive","weather":"fog","oddMon":true},"seeds":[7],"secs":30,"metric":"oddFirst","op":"<=","value":2}},{"id":"A2","type":"assumption","parent":"G5","rel":"context","text":"Rain and floor grip, which the robot cannot observe, are excluded by operating rules"},{"id":"G6","type":"goal","parent":"S1","rel":"support","text":"No contact with a person who waits behind a rack and steps out"},{"id":"E5","type":"solution","parent":"G6","rel":"support","text":"40 random worlds with up to three people who wait for the robot, giving way, search seed 1: no contact","evidence":{"kind":"search","sheet":{"name":"ODD-1 with people who wait","family":"warehouse","like":"L5","w":24,"h":16,"ranges":{"aisle":[2,3.2],"people":[0,4],"stepout":[0,3]},"weather":["clear"],"people":["reactive"]},"budget":40,"seed":1,"metric":"contacts","op":"<=","value":0}}]},"argSet":{},"check":true}}
Setup: ARG-1 with one more claim under the strategy: no contact with a person who waits behind a rack until the robot comes near and then steps out, still giving way, checked by a 40-run search of a domain that includes up to three of them.
See: The new claim is red:
| Search seed | Contacts with the robot moving | Strikes |
|---|---|---|
| 1 (this search, 40 runs) | 11 | none |
| 2 | 12 | none |
| 3 | 8 | none |
Look at both columns: contacts on every search seed, though still no strike.
Shows: The argument as written never mentioned people who step out, and its evidence never met one: the search of ODD-1 drew none. Adding the defeater as a claim of its own turns an unknown into a known gap, here a hazard of bumps rather than strikes. Looking for defeaters, with the search of lesson 5 and with people who know the floor, is the part of safety work no amount of rerunning can do.
Predict: People who wait and step out, giving way. Strikes, contacts?
- Contacts, but no strike
- Strikes as well
- Neither: they give way
Answer: 0

## Think about
Q: The rack claim fails on one seed of six. Could you just leave that seed out?
A: Only by changing the claim, and saying so: "no rack contact above 0.3 m/s at these five seeds" is true and worthless. The seeds stand for the variety of the floor; a failure at one of them is a failure in some of the worlds the robot will meet. An argument that edits its evidence until it passes is the most common way a safety case lies.
Q: Every solution here is a simulation. Is that enough evidence?
A: Not for a real robot. A simulation-based solution carries an assumption of its own, that the simulator's people, sensors and floor behave like the real ones, which the lab says outright it does not in several ways (no materials, no camera, people as discs). A real case backs simulation with track tests and operating data, and argues why the simulation is good enough for the claims it supports: an argument about the evidence itself.
Q: What would make you trust a green top claim?
A: That the claims under it cover the hazards (lesson 2), that the assumptions are few, visible, and either monitored or enforced by operating rules, that the evidence would have caught a problem (it was shown to go red when one was introduced, as in these Trys), and that someone has looked hard for defeaters. A green graph is the end of an argument, not a proof.

## Check yourself
Q: A goal has a strategy with four sub-goals, each supported by one solution. Three solutions pass and one fails. How many of the six goal and strategy nodes (the top goal, the strategy, the four sub-goals) are red?
Answer: 3
Tolerance: 0
Unit: nodes
How: The failed solution's sub-goal is red, so the strategy above it is red, and so the top goal: three. The other three sub-goals stay green.
