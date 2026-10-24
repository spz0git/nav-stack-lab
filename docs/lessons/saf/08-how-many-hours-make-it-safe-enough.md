group: saf
title: How many hours make it safe enough

<p><b>Why this matters.</b> Every lesson so far counted failures in runs. A safety case has to turn those counts into a statement about the future: how often will this robot hurt someone per hour of work, and how sure are we? The honest answer comes with an interval, and the interval is what makes the arithmetic of safety so unforgiving. A rare event cannot be shown to be rare by a little testing: to claim fewer than one contact per thousand hours you need about three thousand hours without one. This lesson measures the busy floor's rate, finds a stack with nothing left to count, works out what that silence is worth, tries the standard trick for rare events, and looks for a measure that warns before anyone is hurt.</p>
<p><b>The standards.</b> ISO 21448 sets acceptance criteria for the residual risk (clause 6, 6.5), turns them into validation targets, an amount of testing (clause 9), and judges at the end whether they were met (clause 12). UL 4600 requires safety performance indicators, measures that show in operation whether the safety case's claims still hold, including leading indicators that move before harm does (clause 16). The lab paraphrases the standards and quotes none of them. The clause numbers are the best available from public outlines (ISO 26262:2018, ISO 21448:2022, ISO/PAS 8800:2024, UL 4600 third edition) and have not been checked against the texts.</p>
<p><b>The idea.</b> The search's random runs are a sample of the domain: together, $T$ hours of operation in which $k$ events happened. If events arrive independently at a rate $\lambda$, $k$ is a Poisson count with mean $\lambda T$, the estimate is $\hat\lambda = k / T$, and the exact 95 % interval comes from the Poisson distribution itself. With no event at all, the probability of that silence is $e^{-\lambda T}$; any $\lambda$ that makes it less than 5 % is ruled out, which leaves</p>
$$\lambda < \frac{-\ln 0.05}{T} \approx \frac{3}{T},$$
<p>the rule of three: zero events in $T$ hours bounds the rate below $3/T$ with 95 % confidence, and to claim a target rate $\lambda^*$ takes about $3/\lambda^*$ hours without an event. Importance sampling draws more of the worlds where events are likely and weights each run by $w = p/q$, how much likelier the domain's own mix $p$ would have drawn it than the sampler $q$; the weighted rate $\sum w_i k_i / \sum w_i T_i$ still describes the domain. A leading indicator is a measure that rises with the contacts across runs but much more often than they happen, so it moves before them.</p>
<p><b>Where it comes from.</b> The Poisson interval, the rule of three, the importance weights and their effective hours, the rank correlation, and the measured searches: <a class="chref" href="#notes=ch8/10-rates-intervals-and-indicators">chapter 8 §10</a>.</p>
<p><b>What the lab does.</b> Tools → Safety → Search; after a search the <i>Risk</i> table takes the random runs (the refined ones were chosen for being bad) as hours of operation: contacts with a person while the robot moves, strikes, and any contact, each with its rate per hour and 95 % interval, and the hours a claim of one per thousand hours would need. <i>Importance sampling</i> draws the people with density $q(x) = 2x$ over their range and weights each run by $1/(2x)$. <i>Leading indicators</i> ranks each per-hour measure against the runs' contacts per hour (Spearman's $\rho$) and plots the best one run by run. The Try buttons run 40 random runs at search seed 1, about a minute in the page; <code>node tools/search.mjs --budget 40 --rounds 0 --seed 1</code> runs the same headless.</p>

## Try: The busy floor's domain, per hour
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":"ODD-1","budget":40,"rounds":0,"seed":1,"run":true}}
Setup: ODD-1, 40 worlds at random: generated warehouses with aisles of 2 to 3.2 m and up to four scripted people, the busy floor's settings, each run to Mission complete.
See: 1.27 hours of operation and 18 contacts with a person: 14 per hour, the 95 % interval 8.4 to 22. Eleven were strikes: 8.6 per hour, 4.3 to 15. At search seeds 2 and 3, 14.6 (8.9 to 22.5) and 9.7 (5.0 to 16.9) contacts per hour.
Shows: A contact every four minutes of work, give or take a factor of two. The interval is wide, but it does not matter here: even its bottom is four orders of magnitude from a rate anyone would accept, and no amount of testing changes that. The stack, not the statistics, is the problem.
Predict: How many contacts with a person per hour of operation does ODD-1 have?
- About ten or more: one every few minutes
- About one
- Fewer than one in a hundred hours
Answer: 0

## Try: People who react: nothing left to count
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":{"name":"ODD-1, people who react","family":"warehouse","like":"L5","w":24,"h":16,"ranges":{"aisle":[2,3.2],"people":[0,4],"stepout":[0,0]},"weather":["clear"],"people":["reactive"]},"budget":40,"rounds":0,"seed":1,"run":true}}
Setup: The same domain with people who react to the robot (the social-force model lesson 2 used for controllability).
See: No strike in 1.26 hours; the table's interval runs from 0 to 2.9 per hour. Five contacts with the robot moving, 4.0 per hour. At search seeds 2 and 3 there is no contact with the robot moving at all, in 1.34 and 1.24 hours. A claim of fewer than one contact per 1 000 hours would need about 3 000 hours without one: some 2 400 searches like this.
Shows: Silence is evidence, but weak: no strike in 1.26 hours says only that the strike rate is below 3 / 1.26 ≈ 2.4 per hour with 95 % confidence. The number that matters is the hours, not the runs: a target rate fixes the testing it needs, and for real targets that is far more than any test track gives. That is why the standards lean on searches for the scenarios that matter and on arguments about why the rest are covered, not on driving until the count is large enough.
Predict: No strike in 1.26 hours of operation. What can you claim at 95 %?
- Fewer than about 2.4 strikes per hour
- Fewer than one strike per 1 000 hours
- That it never strikes
Answer: 0

## Try: Importance sampling, and its price
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":{"name":"ODD-1, people who react","family":"warehouse","like":"L5","w":24,"h":16,"ranges":{"aisle":[2,3.2],"people":[0,4],"stepout":[0,0]},"weather":["clear"],"people":["reactive"]},"budget":40,"rounds":0,"seed":1,"imp":true,"run":true}}
Setup: The same search with importance sampling: the worlds drawn with more people, where a strike is likelier, each run weighted by how much likelier the domain's own even mix would have drawn it.
See: Still no strike, and the interval's top is now 3.75 per hour instead of 2.9: wider. Three contacts with the robot moving, weighted to 1.7 per hour, 0 to 4.5. At search seeds 2 and 3 the same: no strike, and a top of 4.86 and 3.76 per hour against 2.76 and 2.97 without.
Shows: Importance sampling pays when the worlds it oversamples are where the events happen and they do happen there; then each event, down-weighted, pins the rate with fewer runs. Here the people-dense worlds held no strike either, and the weights spent part of the budget: a few heavily weighted runs with few people count for many hours each, so the sample is worth fewer effective hours than it ran. The trick needs a good guess of where the danger is, which is what the search of lesson 5 is for.
Predict: The same budget drawn where strikes should be likelier, and still none. Is the bound on the strike rate tighter than without?
- No, wider: the weights cost effective hours
- Yes: more of the dangerous worlds were tested
- The same: the budget did not change
Answer: 0

## Try: Which measure warns before the harm
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":"ODD-1","budget":40,"rounds":0,"seed":2,"run":true}}
Setup: ODD-1 at search seed 2. The Leading indicators table ranks each measure per hour, run by run, against the runs' contacts per hour.
See: Seconds under 0.3 m of a person first, ρ 0.86; seconds with a time to contact under 1 s, 0.81; the closest approach, 0.77; seconds with a person within 2 m last, 0.60. In every search measured that had contacts to rank against (ODD-1 at three search seeds, with and without importance sampling, with people who react, with narrow aisles) a measure of how close the robot came ranks first, and the time with a person within 2 m ranks last.
Shows: A leading indicator has to track the harm, not the exposure to it. Time near people measures how much of the work happens among them, which every warehouse robot has; time very close to them, or about to meet them, measures how the robot handles it. The first is a reason to look; the second is the indicator a safety case watches in operation, with a threshold that says when its claims are in trouble before anyone is hurt.
Predict: Which of the four measures ranks last against the contacts?
- Seconds with a person within 2 m
- Seconds under 0.3 m of a person
- The closest approach
Answer: 0

## Think about
Q: The first search gave 8.4 to 22 contacts per hour. Would 400 runs instead of 40 help?
A: The interval would shrink about threefold, to something like 12 to 16 per hour, and the conclusion would not change: the rate is thousands of times too high. More testing sharpens an estimate; it never makes a system safer. When the bottom of the interval is already unacceptable, the next step is a design change, and the testing comes after.
Q: Why does the Risk table leave out the refined runs?
A: They were chosen for being bad: the refinement perturbs the worst runs so far, so their contact rate is the search's bias, not the domain's. Only the random half samples the domain as the sheet describes it. Mixing them in would overstate the rate by an amount nobody could correct for, unlike importance sampling, whose bias is known and undone by the weights.
Q: The rate is per hour of operation in the sheet's even mix of worlds. What if real floors are mostly quiet?
A: Then the domain's mix is wrong, and so is the rate: a robot that spends most of its hours on empty floors has a lower rate per hour than this one, and the same per hour among people. The exposure, how much time is spent in each kind of world, is part of the estimate. A real safety case measures it from operation and weights the scenario rates by it, exactly as importance sampling weights its runs.

## Check yourself
Q: No contact in 1.5 hours of operation. Below what rate per hour does the rule of three put the contacts, at 95 %?
Answer: 2
Tolerance: 0.05
Unit: per hour
How: $3 / 1.5 = 2$ per hour (more exactly $-\ln 0.05 / 1.5 = 2.0$). To bring the bound down to one per thousand hours, about 3 000 hours without a contact are needed.
