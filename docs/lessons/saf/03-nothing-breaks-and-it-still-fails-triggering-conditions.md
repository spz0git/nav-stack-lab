group: saf
title: Nothing breaks, and it still fails: triggering conditions

<p><b>Why this matters.</b> The busy floor's stack touches a person once a run, and nothing in it is broken. Every sensor works, every filter is tuned, and every block does what it was designed to do. The design is just not good enough for one situation. In automated driving and in mobile robots, this kind of failure is the most common one. Their hardest parts are perception and prediction, and these can meet their own specification and still be wrong about the world. In this lesson you find the situations on the busy floor that expose the design, fix one of them, and check for each whether the stack can tell it is in trouble. ISO 21448 was written for this kind of failure (SOTIF, the safety of the intended functionality). It asks for the situations that defeat a working stack to be found, and then fixed or restricted by keeping the robot out of them. A search for broken parts would never find them, since no part is broken. The four standards are introduced in <a class="chref" href="#notes=ch8/1-the-four-standards-in-the-lab-s-words">chapter 8 §1</a>.</p>
<p><b>The idea.</b> A functional insufficiency is a way in which the function is not good enough. On the busy floor there is a predictor that assumes people keep walking, a lidar that sees only 4 m in fog, and a sonar that hears nothing inside 0.2 m. A triggering condition is a situation that exposes an insufficiency. For those three it is a person turning back beside the robot, fog, and a person very close. Sort every situation in two ways: known or unknown to the designers, and safe or unsafe. The work is then to shrink the two unsafe areas. You change the function so that known-unsafe situations become safe, and you search for the unknown-unsafe ones so that they become known.</p>
$$\underbrace{\text{known, safe}}_{\text{grow}} \quad \underbrace{\text{known, unsafe}}_{\text{fix or restrict}} \quad \underbrace{\text{unknown, unsafe}}_{\text{search}} \quad \text{unknown, safe}$$
<p><b>Where it comes from.</b> How faults differ from insufficiencies, the four areas, whether the stack can notice a condition, and the measured table of this lesson are in <a class="chref" href="#notes=ch8/5-triggering-conditions-and-functional-insufficiencies">chapter 8 §5</a>. The measures are defined in <a class="chref" href="#notes=ch8/4-the-safety-measures-the-simulator-keeps">§4</a>. The next paragraph gives what you need to read them.</p>
<p><b>What the lab does.</b> Every experiment is L5 with nothing switched off. The <button type="button" class="linkbtn" data-met="">Metrics list</button> beside the event log has these rows, among others. <button type="button" class="linkbtn" data-met="Contacts by speed">Contacts by speed</button> lists each contact with its relative speed and its class: a touch below 0.3 m/s, a bump up to 1 m/s, a strike above. <button type="button" class="linkbtn" data-met="Wall clearance">Wall clearance</button> is the smallest gap between the robot and a rack in the run. <button type="button" class="linkbtn" data-met="Under 0.3 m of a person">Under 0.3 m of a person</button> counts the seconds the robot is that close to someone. <button type="button" class="linkbtn" data-met="Time to contact">Time to contact</button> is the gap to a person divided by the speed at which the two are closing, which is how long until contact if neither changes course. It shows the smallest value in the run and the seconds spent under 1 s. These last two rows move long before a contact happens, and far more often. The health lights at the top show what the stack itself noticed. The numbers quoted are for seed 7, counted up to Mission complete.</p>

## Try: The busy floor, nothing changed
cfg: {"sim":true,"level":4,"tab":"per","layers":{"agents":true}}
Setup: L5 as it is, with the speed planner, lidar tracking and a constant-velocity prediction of each person.
See: There is one contact, a bump at 0.73 m/s at 51.6 s. Watch the person who reaches the end of their walk beside the robot. They turn back, but the prediction still has them walking on, so the speed planner lets the robot go and the two meet. The Person nearby light comes on a moment before the contact, and nothing warned earlier. On seeds 2 to 5 the same contact happens at 51 to 52 s.
Shows: This is now a known-unsafe situation. Its triggering condition is a person turning back at the end of a walk, beside the robot. The insufficiency it exposes is in the prediction, because a constant-velocity prediction cannot see a turn coming. The contact repeats on every seed, which shows that it comes from the design and not from the noise.
Predict: Nothing is switched off, nothing is mis-tuned. How many contacts with a person up to Mission complete?
- One
- None: with every sensor and filter working there is nothing to go wrong
- Several, one per person
Answer: 0

## Try: Three futures for each person
cfg: {"sim":true,"level":4,"set":{"agPred":"learned"},"tab":"per","layers":{"agents":true}}
Setup: The learned predictor from the perception lessons. It gives three possible futures for each person, each with a probability, so a turn at the end of a walk is one of the futures the speed planner can allow for.
See: There is no contact at 51 s. There is a new one at 100.6 s, a strike at 1.35 m/s. On seeds 2 to 5 the 51 s contact never happens. Two of the four runs have a contact near 102 s, and two have none.
Shows: Changing the function moved one situation from known-unsafe to safe. The same change exposed another situation, one that the old design happened to get through, and there the new predictor's own insufficiencies show. So a fix has to be checked against every known situation, including the ones it was not made for, and the search for unknown ones starts again.
Predict: With three futures per person, does the contact at 51 s still happen?
- No
- Yes: the person still turns back
- Only on some seeds
Answer: 0

## Try: Fog
cfg: {"sim":true,"level":4,"set":{"weather":"fog"},"tab":"per","layers":{"agents":true,"lidar":true}}
Setup: Fog is switched on. The lidar now reaches 4 m instead of 8, misses some beams, and gets returns from the air itself. Nothing is broken; this is how a lidar works in fog.
See: The fog makes tracks where there is nobody, and the speed planner yields to them. This run's one contact is now a strike at 1.45 m/s, at 101 s.
| Run | Yields in fog | Yields in clear air | Contacts with a person |
|---|---|---|---|
| this run | 10 | 4 | 1 |
| seeds 2 to 5 | 9 to 15 | 5 to 8 | one to four |
Look at the yields. They go up on every run, and no health light mentions the fog at any point.
Shows: Fog is a triggering condition that affects perception in two ways. It makes phantom tracks, which stop the robot for nothing, and it shortens the lidar's reach, which leaves less time to react to a real person. The stack has no way to notice the fog, because no light watches how many beams come back. A condition the robot cannot detect has to be dealt with in the design, or in the domain by keeping the robot out of it.
Predict: Turn the fog on. How many times does the speed planner yield (the "yielding" lines in the event log), compared with clear air?
- More: it yields to tracks of nobody
- Fewer: it sees less, so it reacts to less
- The same: the people are the same
Answer: 0

## Try: The particle filter's bad seed
cfg: {"sim":true,"level":4,"seed":1,"tab":"loc","layers":{"belief":true}}
Setup: L5 at seed 1 instead of 7. The floor and the settings are the same; only the draw of the noise is different.
See: The Localize light is red from the start and keeps coming back, because the particle cloud spreads out again and again in the repeating warehouse. Each time, the lost guard holds the robot until it relocalizes. That happens 63 times, and the robot is held for 76 s in all. The mission takes 249 s instead of 121, and the planner reports no path at 43 s. The robot strikes a person twice at 1.05 m/s, at 122 and 169 s, and both times its estimate is right to within 5 cm.
Shows: The triggering condition is a symmetric warehouse with unlabeled beacons. The insufficiency is a filter that cannot tell the mirror poses apart. The stack notices this condition, as it did not notice the fog, and it answers with a degraded mode: hold and relocalize. The cost is a mission twice as long. The holds also have a side effect. A robot that stops and starts meets the people at different places and times than it otherwise would. Two of those meetings end in a strike while the estimate is right, so the position error did not cause them. The holds set up encounters that the robot would otherwise not have had.
Predict: At seed 1 the particle filter keeps losing the robot. Does the stack notice?
- Yes: the Localize light goes red and the robot holds to relocalize
- No: it drives on to the wrong goals without a warning
- Only at the end, when a goal is missed
Answer: 0

## Try: The sonar safety stop, a person very close
cfg: {"sim":true,"level":4,"set":{"agents":"off","spd":"none","people":"reactive","guard":true,"sonar":true,"guardSrc":"sonar"},"goals":[[12,1.6],[12,15],[12,1.6]],"tab":"ctl","layers":{"sonar":true}}
Setup: The walk from the perception lesson, up the middle aisle and back. The people react, and a safety stop reads only the ultrasonic ring. Tracking is off, so the stop is the only defence.
See: There are two contacts, at 21.5 and 43.9 s, and both are bumps. With the stop reading the lidar instead, the same walk has none. Seeds 2 to 5 give the same two contacts at the same moments.
Shows: The triggering condition is a person closer than 0.2 m, inside every sonar's dead zone. The ring hears nothing there, so the stop sees free floor and the robot drives on. The Person nearby light comes on only at the contact. A safety stop works only where its sensor works, and this one has a blind zone right next to the robot.
Predict: The stop now reads the sonar ring, which cannot hear inside 0.2 m. Contacts on the walk?
- Some: a person inside 0.2 m is not heard
- None: the stop holds the robot whatever it reads
- The same as the lidar stop: none
Answer: 0

## Think about
Q: In which of the five runs was anything broken?
A: None. Every contact here came from a part of the design that was not good enough for a situation. In the first two runs it was the prediction, in the fog and sonar runs it was the physics of a sensor, and at seed 1 it was the filter's assumption that it can tell the poses apart. ISO 21448 starts from this. A system whose parts all work as specified can still be unsafe, and the work is to find the situations where it is.
Q: The learned predictor fixed the 51 s contact and a new contact appeared near 100 s. Was the new one caused by the fix?
A: It may or may not have been. With the old predictor the robot was somewhere else at 100 s, because the two runs had already gone different ways at 51 s. Either way, the new contact was unknown before and is known now. So after a change you rerun the whole set of known situations, and the search for unknown ones is never finished.
Q: Which of the triggering conditions could the stack be taught to notice, and with what?
A: Fog could be noticed from the share of lidar beams that come back, or from the radar and the lidar disagreeing. A turn at the end of a walk could be noticed from a person slowing down near the end of their route. A person inside the sonar's dead zone cannot be noticed by the sonar at all; that takes another sensor. A condition the stack notices can be answered with a degraded mode, slower or stopped. One it does not notice can be handled only in the design, or by keeping the robot out of it.

## Check yourself
Q: In fog the lidar sees 4 m. A person walks straight at the robot at 0.9 m/s while the robot drives at 0.8 m/s towards them. How many seconds pass between the person entering the lidar's reach and contact, ignoring the bodies' size?
Answer: 2.35
Tolerance: 0.05
Unit: s
How: They close at $0.9 + 0.8 = 1.7$ m/s, so 4 m takes $4 / 1.7 = 2.35$ s. In clear air the 8 m reach gives $8 / 1.7 = 4.7$ s. The fog halves the time the stack has to confirm a track, predict the person's path and slow down.
