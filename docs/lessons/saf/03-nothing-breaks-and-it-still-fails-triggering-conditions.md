group: saf
title: Nothing breaks, and it still fails: triggering conditions

<p><b>Why this matters.</b> The busy floor's stack touches a person once a run, and nothing in it is broken: every sensor works, every filter is tuned, every block does what it was designed to do. The design was not good enough for one situation. That kind of failure is the one that dominates automated driving and mobile robots, because their hardest parts, perception and prediction, can be correct by their own specification and still wrong about the world. This lesson finds the situations that expose it on the busy floor, fixes one, and asks of each whether the stack can tell it is in trouble.</p>
<p><b>The standards.</b> ISO 21448, the safety of the intended functionality (SOTIF), is about exactly this: gaps in the specification or the performance of a function with no fault involved and the conditions that expose them (clause 7), the changes that answer them (clause 8), and the four areas of known and unknown situations (its introduction and clause 4). ISO 26262 covers the other kind, a part that fails, which is the next lesson's subject. The lab paraphrases the standards and quotes none of them. The clause numbers are the best available from public outlines (ISO 26262:2018, ISO 21448:2022, ISO/PAS 8800:2024, UL 4600 third edition (2023)) and have not been checked against the texts.</p>
<p><b>The idea.</b> A functional insufficiency is a way the function is not good enough: a predictor that assumes people keep walking, a lidar that sees 4 m in fog, a sonar deaf inside 0.2 m. A triggering condition is a situation that exposes it: a person turning back beside the robot, fog, a person very close. Sort every situation two ways, known or unknown to the designers and safe or unsafe, and the work is to shrink the unsafe areas: change the function so that known-unsafe situations become safe, and search for the unknown-unsafe ones so they become known.</p>
$$\underbrace{\text{known, safe}}_{\text{grow}} \quad \underbrace{\text{known, unsafe}}_{\text{fix or restrict}} \quad \underbrace{\text{unknown, unsafe}}_{\text{search}} \quad \text{unknown, safe}$$
<p><b>Where it comes from.</b> Faults against insufficiencies, the four areas, whether the stack can notice, and the measured table of this lesson: <a class="chref" href="#notes=ch8/5-triggering-conditions-and-functional-insufficiencies">chapter 8 §5</a>. The time to contact and the other measures the Metrics list shows are defined in <a class="chref" href="#notes=ch8/4-the-safety-measures-the-simulator-keeps">§4</a>.</p>
<p><b>What the lab does.</b> Every experiment is L5 with nothing switched off. The Metrics list beside the event log has the contacts by speed and class; the health lights at the top say what the stack itself noticed. The numbers are seed 7, counted up to Mission complete.</p>

## Try: The busy floor, nothing changed
cfg: {"sim":true,"level":4,"tab":"per","layers":{"agents":true}}
Setup: L5 as it is: the speed planner, lidar tracking, constant-velocity prediction of each person.
See: One contact, at 51.6 s and 0.73 m/s, a bump. Watch the person at the end of their walk beside the robot: they turn back, the prediction still has them walking on, the speed planner lets the robot go, and the two meet. The Person nearby light comes on a moment before the contact; nothing warned earlier. On seeds 2 to 5 the same contact happens at 51 to 52 s.
Shows: A known-unsafe situation, with its triggering condition (a person reversing at the end of a walk, beside the robot) and the insufficiency it exposes (a constant-velocity prediction cannot see a turn coming). It repeats on every seed because it comes from the design, not from noise.
Predict: Nothing is switched off, nothing is mis-tuned. How many contacts with a person up to Mission complete?
- One
- None: with every sensor and filter working there is nothing to go wrong
- Several, one per person
Answer: 0

## Try: Three futures for each person
cfg: {"sim":true,"level":4,"set":{"agPred":"learned"},"tab":"per","layers":{"agents":true}}
Setup: The learned predictor of the perception lessons: three possible futures per person with a probability each, so a turn at the end of a walk is one of the futures the speed planner can respect.
See: No contact at 51 s. A new one at 100.6 s, at 1.35 m/s, a strike. On seeds 2 to 5 the 51 s contact never happens; two of the four runs have a contact near 102 s and two have none.
Shows: Changing the function moved a situation from known-unsafe to safe, and the same change exposed another: the predictor's own insufficiencies, in a situation the old design happened to get through. A fix is checked against every known situation, not only the one that motivated it, and the search for unknown ones starts again.
Predict: With three futures per person, does the contact at 51 s still happen?
- No
- Yes: the person still turns back
- Only on some seeds
Answer: 0

## Try: Fog
cfg: {"sim":true,"level":4,"set":{"weather":"fog"},"tab":"per","layers":{"agents":true,"lidar":true}}
Setup: Fog: the lidar reaches 4 m instead of 8, misses some beams, and sees returns from the air itself. Nothing is broken; the lidar is working as a lidar works in fog.
See: The speed planner yields 10 times against 4 in clear air, to tracks the fog makes of nobody, and the one contact is now a strike at 101 s, 1.45 m/s. No health light mentions the fog at any point. On seeds 2 to 5 the yields go up on every run (9 to 15 against 5 to 8), and the contacts range from one to four.
Shows: A triggering condition that hits perception twice, as phantom tracks that stop the robot for nothing and as a shorter reach that leaves less time for a real person. The stack has no way to notice it: no light watches how many beams return. A condition the robot cannot detect has to be handled in the domain or the design.
Predict: Turn the fog on. How many times does the speed planner yield (the "yielding" lines in the event log), compared with clear air?
- More: it yields to tracks of nobody
- Fewer: it sees less, so it reacts to less
- The same: the people are the same
Answer: 0

## Try: The particle filter's bad seed
cfg: {"sim":true,"level":4,"seed":1,"tab":"loc","layers":{"belief":true}}
Setup: L5 at seed 1 instead of 7: the same floor, the same settings, a different draw of the noise.
See: The Localize light is red from the start and keeps coming back: the particle cloud spreads out again and again in the repeating warehouse, and each time the lost guard holds the robot until it relocalizes, 63 times, 76 s held in all. The mission takes 249 s instead of 121, the planner reports no path at 43 s, and the robot strikes a person twice at 1.05 m/s, at 122 and 169 s, both times with its estimate right to within 5 cm.
Shows: Unlabeled beacons in a symmetric warehouse are the triggering condition; a filter that cannot tell the mirror poses apart is the insufficiency. Unlike the fog, this one the stack notices, and answers with a degraded mode: hold and relocalize. The answer has a price, a mission twice as long, and a side effect: a robot that stops and starts meets the people at different places and times, and two of those meetings end in a strike with the estimate right, so the filter did not cause them; the encounters it set up did.
Predict: At seed 1 the particle filter keeps losing the robot. Does the stack notice?
- Yes: the Localize light goes red and the robot holds to relocalize
- No: it drives on to the wrong goals without a warning
- Only at the end, when a goal is missed
Answer: 0

## Try: The sonar safety stop, a person very close
cfg: {"sim":true,"level":4,"set":{"agents":"off","spd":"none","people":"reactive","guard":true,"sonar":true,"guardSrc":"sonar"},"goals":[[12,1.6],[12,15],[12,1.6]],"tab":"ctl","layers":{"sonar":true}}
Setup: The perception lesson's walk up and down the middle aisle and back, with people who react and a safety stop that reads only the ultrasonic ring; tracking off, so the stop is the only defence.
See: Two contacts, at 21.5 and 43.9 s, both bumps. With the stop on the lidar instead, the same walk has none. Seeds 2 to 5 give the same two contacts at the same moments.
Shows: A person closer than 0.2 m, inside every sonar's dead zone, is the triggering condition: the ring hears nothing, the stop sees free floor, and the robot drives on. The Person nearby light comes on at the contact, not before. A safety function is only as good as the sensor under it, in the situations that sensor cannot see.
Predict: The stop now reads the sonar ring, which cannot hear inside 0.2 m. Contacts on the walk?
- Some: a person inside 0.2 m is not heard
- None: the stop holds the robot whatever it reads
- The same as the lidar stop: none
Answer: 0

## Think about
Q: In which of the five runs was anything broken?
A: None. Every contact here came from a design that was not good enough for a situation: a prediction, a sensor's physics, a filter's assumption. That is the point of ISO 21448: a perfectly reliable system, every part working as specified, can still be unsafe, and the work is to find out where.
Q: The learned predictor fixed the 51 s contact and a new contact appeared near 100 s. Was the new one caused by the fix?
A: Possibly, possibly not: with the old predictor the robot was in a different place at 100 s, because the run had already diverged at 51 s. Either way the new contact was unknown before and is known now. That is why a change is judged against the whole set of known situations, rerun, and why the search for unknown ones is never finished.
Q: Which of the triggering conditions could the stack be taught to notice, and with what?
A: Fog, from the share of lidar beams that come back or from the radar and lidar disagreeing; a turn at the end of a walk, from a person slowing down near the end of their route; a person inside the sonar's dead zone, not from the sonar at all, only from another sensor. A noticed condition can be answered with a degraded mode, slower or stopped; an unnoticed one only by the design or by keeping the robot out of it.

## Check yourself
Q: In fog the lidar sees 4 m. A person walks straight at the robot at 0.9 m/s while the robot drives at 0.8 m/s towards them. How many seconds pass between the person entering the lidar's reach and contact, ignoring the bodies' size?
Answer: 2.35
Tolerance: 0.05
Unit: s
How: They close at $0.9 + 0.8 = 1.7$ m/s, so 4 m takes $4 / 1.7 = 2.35$ s, against $8 / 1.7 = 4.7$ s in clear air: half the time to confirm a track, predict and slow down.
