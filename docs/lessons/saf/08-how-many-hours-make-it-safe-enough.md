group: saf
title: How many hours make it safe enough

<p><b>Why this matters.</b> Every lesson so far counted failures in runs. A safety case has to turn those counts into a statement about the future: how often this robot will hurt someone per hour of work, and how sure we can be of that. The answer is a rate with an interval around it, and the interval is what makes the arithmetic hard. A little testing cannot show that a rare event is rare. To claim fewer than one contact per thousand hours, you need about three thousand hours without one. In this lesson you first measure the busy floor's rate per hour. Then you take a stack that makes no strike in its test and work out what that tells you. Next you try importance sampling, the usual method for rare events. Last, you look for a measure that warns before anyone is hurt.</p>
<p><b>In the standards.</b> ISO 21448 asks for the acceptable rate of harm to be decided before testing starts, and then turned into the number of test hours that could show it. That way a result cannot be argued into a pass afterwards. The arithmetic in this lesson is that conversion. UL 4600 asks for the counting to go on after the robot goes to work, through safety performance indicators, because a claim made from test hours can stop being true on a real floor. It asks for some of them to be leading indicators, measures that rise before anyone is hurt. The four standards are in <a class="chref" href="#notes=ch8/1-the-four-standards-in-the-lab-s-words">chapter 8 §1</a>.</p>
<p><b>The idea.</b> The search's random runs are a sample of the domain. Together they make $T$ hours of operation, in which $k$ events happened. If events arrive independently at a rate $\lambda$, then $k$ is a Poisson count with mean $\lambda T$. The estimate of the rate is $\hat\lambda = k / T$, and the exact 95 % interval comes from the Poisson distribution itself. If there was no event at all, the probability of seeing none is $e^{-\lambda T}$. Any $\lambda$ that makes this probability less than 5 % is ruled out, which leaves</p>
$$\lambda < \frac{-\ln 0.05}{T} \approx \frac{3}{T},$$
<p>known as the rule of three. With zero events in $T$ hours, the rate is below $3/T$ with 95 % confidence. To claim a target rate $\lambda^*$, you need about $3/\lambda^*$ hours without an event. Importance sampling draws more of the worlds where events are likely, and weights each run by $w = p/q$. The weight says how much more likely the domain's own mix $p$ was to draw that world than the sampler $q$ was. The weighted rate $\sum w_i k_i / \sum w_i T_i$ then still describes the domain. A leading indicator is a measure that rises with the contacts across runs but happens much more often than they do, so it moves before them.</p>
<p><b>Where it comes from.</b> The Poisson interval, the rule of three, the importance weights and their effective hours, the rank correlation, and the measured searches are in <a class="chref" href="#notes=ch8/10-rates-intervals-and-indicators">chapter 8 §10</a>.</p>
<p><b>What the lab does.</b> The tools are under Tools → Safety → Search. After a search, the <i>Risk</i> table treats the random runs as hours of operation. It leaves out the refined runs, which were chosen for being bad. For contacts with a person while the robot moves, for strikes and for any contact, it gives the rate per hour with its 95 % interval. It also gives the hours that a claim of one per thousand hours would need. <i>Importance sampling</i> draws the people with density $q(x) = 2x$ over their range, and weights each run by $1/(2x)$. <i>Leading indicators</i> ranks each per-hour measure against the runs' contacts per hour (Spearman's $\rho$), and plots the best one run by run. The Try buttons make 40 random runs at search seed 1, which takes about a minute in the page. The search seed is set under Search. It fixes which worlds are drawn, so the same number gives the same 40 runs. <code>node tools/search.mjs --budget 40 --rounds 0 --seed 1</code> runs the same search headless.</p>

## Try: The busy floor's domain, per hour
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":"ODD-1","budget":40,"rounds":0,"seed":1,"run":true}}
Setup: ODD-1, with 40 worlds drawn at random. They are generated warehouses with aisles of 2 to 3.2 m and up to four scripted people, run with the busy floor's settings, each to Mission complete.
See: The runs add up to 1.27 hours of operation, with 18 contacts with a person, eleven of them strikes. Per hour, with the 95 % interval:
| Search seed | Contacts per hour | Strikes per hour |
|---|---|---|
| 1 (this search) | 14 (8.4 to 22) | 8.6 (4.3 to 15) |
| 2 | 14.6 (8.9 to 22.5) | — |
| 3 | 9.7 (5.0 to 16.9) | — |
Look at the intervals. They overlap, and the lowest of their lower ends is 5.0 contacts an hour.
Shows: The estimate for this search is 14 contacts an hour, about one every four minutes of work. Its interval runs from 8.4 to 22 an hour, which is about one contact every seven minutes at best and one every three minutes at worst. The interval is wide, but that does not change the conclusion. Take as an acceptable rate the claim the Risk table works out the hours for: one contact per thousand hours, or 0.001 an hour. The lowest lower end of the three searches, 5.0 an hour, is 5 000 times that rate, nearly four orders of magnitude. More testing would only narrow the interval. To get near the target, the stack itself has to change.
Predict: How many contacts with a person per hour of operation does ODD-1 have?
- About ten or more: one every few minutes
- About one
- Fewer than one in a hundred hours
Answer: 0

## Try: People who react: nothing left to count
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":{"name":"ODD-1, people who react","family":"warehouse","like":"L5","w":24,"h":16,"ranges":{"aisle":[2,3.2],"people":[0,4],"stepout":[0,0]},"weather":["clear"],"people":["reactive"]},"budget":40,"rounds":0,"seed":1,"run":true}}
Setup: The same domain, with people who react to the robot (the social-force model that lesson 2 used for controllability).
See: No strike in 1.26 hours.
| Search seed | Hours of operation | Contacts with the robot moving |
|---|---|---|
| 1 (this search) | 1.26 | 5, 4.0 per hour |
| 2 | 1.34 | none |
| 3 | 1.24 | none |
For this search the table's two-sided 95 % interval on strikes runs from 0 to 2.9 per hour. A claim of fewer than one contact per 1 000 hours would need about 3 000 hours without one, which is some 2 400 searches like this one.
Shows: No strike in 1.26 hours says only that the strike rate is below 3 / 1.26 ≈ 2.4 per hour, with 95 % confidence. That bound is one-sided: it puts the whole 5 % above it. The table's 2.9 (3.69 / 1.26) is the top of a two-sided interval, which puts only 2.5 % above its top, so it reaches higher. What counts is the hours of operation, however many runs they are split into. A target rate sets the hours of testing it needs, and for real targets that is far more than any test track provides. Driving until the count is large enough is not practical. So the standards rely on searching for the scenarios that matter, and on arguments for why the rest are covered.
Predict: No strike in 1.26 hours of operation. What can you claim at 95 %?
- Fewer than about 2.4 strikes per hour
- Fewer than one strike per 1 000 hours
- That it never strikes
Answer: 0

## Try: Importance sampling, and its price
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":{"name":"ODD-1, people who react","family":"warehouse","like":"L5","w":24,"h":16,"ranges":{"aisle":[2,3.2],"people":[0,4],"stepout":[0,0]},"weather":["clear"],"people":["reactive"]},"budget":40,"rounds":0,"seed":1,"imp":true,"run":true}}
Setup: The same search with importance sampling. Worlds with more people, where a strike is likelier, are drawn more often. Each run is weighted by how much more likely the domain's own even mix was to draw it.
See: There is still no strike, on any search seed. There are three contacts with the robot moving, which weight to 1.7 per hour, with an interval of 0 to 4.5. The top of the two-sided interval on strikes:
| Search seed | With importance sampling (per hour) | Without (per hour) |
|---|---|---|
| 1 (this search) | 3.75 | 2.9 |
| 2 | 4.86 | 2.76 |
| 3 | 3.76 | 2.97 |
Compare the columns. On every search seed the interval is wider with importance sampling.
Shows: Importance sampling helps when the worlds it draws more often are where the events happen, and the events do happen there. Each event is then weighted down, and the rate is pinned with fewer runs. Here the worlds with many people had no strike either, and the weights used up part of the budget. A few runs with few people carry heavy weights, and each of them counts for many hours. So the sample is worth fewer effective hours than it actually ran. The method needs a good guess of where the danger is, and the search of lesson 5 is a way to find one.
Predict: The same budget drawn where strikes should be likelier, and still none. Is the bound on the strike rate tighter than without?
- No, wider: the weights cost effective hours
- Yes: more of the dangerous worlds were tested
- The same: the budget did not change
Answer: 0

## Try: Which measure warns before the harm
cfg: {"sim":true,"level":4,"tab":"saf","hold":true,"saf":{"sheet":"ODD-1","budget":40,"rounds":0,"seed":2,"run":true}}
Setup: ODD-1 at search seed 2. The Leading indicators table ranks each measure per hour, run by run, against the runs' contacts per hour.
See: The ranking, first to last:
| Measure | ρ |
|---|---|
| seconds under 0.3 m of a person | 0.86 |
| seconds with a time to contact under 1 s | 0.81 |
| the closest approach | 0.77 |
| seconds with a person within 2 m | 0.60 |
Both ends of the order are the same in every search measured that had contacts to rank against. A measure of how close the robot came ranks first, and the time with a person within 2 m ranks last. The searches measured are ODD-1 at three search seeds, with and without importance sampling, with people who react, and with narrow aisles.
Shows: A leading indicator has to rise with the harm. Time near people only measures how much of the work happens among them, and every warehouse robot spends time among people. Time very close to people, or about to meet one, measures how well the robot handles them. So time near people is the exposure, and at most a reason to look more closely. Time very close is the indicator that a safety case watches in operation. It is given a threshold, and crossing the threshold says the claims are in trouble before anyone is hurt.
Predict: Which of the four measures ranks last against the contacts?
- Seconds with a person within 2 m
- Seconds under 0.3 m of a person
- Seconds with a time to contact under 1 s
- The closest approach
Answer: 0

## Think about
Q: The first search gave 8.4 to 22 contacts per hour. Would 400 runs instead of 40 help?
A: The interval would shrink about threefold, to something like 12 to 16 per hour, and the conclusion would stay the same: the rate is thousands of times too high. More testing gives a sharper estimate of the same rate. When even the bottom of the interval is unacceptable, the next step is a design change, and the testing comes after it.
Q: Why does the Risk table leave out the refined runs?
A: They were chosen for being bad. The refinement perturbs the worst runs so far, so their contact rate reflects how the search chose them. Only the random half samples the domain as the sheet describes it. Mixing the refined runs in would overstate the rate by an amount nobody could correct for. Importance sampling is biased too, but its bias is known, and the weights undo it.
Q: The rate is per hour of operation in the sheet's even mix of worlds. What if real floors are mostly quiet?
A: Then the domain's mix is wrong, and so is the rate. A robot that spends most of its hours on empty floors has a lower rate per hour than this one, and the same rate per hour spent among people. The exposure, how much time is spent in each kind of world, is part of the estimate. A real safety case measures the exposure in operation and weights the scenario rates by it, in the same way importance sampling weights its runs.

## Check yourself
Q: No contact in 1.5 hours of operation. Below what rate per hour does the rule of three put the contacts, at 95 %?
Answer: 2
Tolerance: 0.05
Unit: per hour
How: $3 / 1.5 = 2$ per hour (more exactly $-\ln 0.05 / 1.5 = 2.0$). To bring the bound down to one per thousand hours, you would need about 3 000 hours without a contact.
