group: loc
title: GNSS: the noise is not white

<p><b>Why this matters.</b> Outdoors, the first position sensor anyone reaches for is GNSS, which means GPS and its siblings. A receiver says where on Earth it is, anywhere under open sky, with nothing installed. Its fixes are good to a metre or so, which sounds like plenty to keep a car in its lane. The difficulty lies in how the error behaves over time more than in its size. A receiver's error drifts slowly, over a minute. So ten fixes in a row are mostly the same error ten times, and not ten independent pieces of evidence. Every filter in the earlier lessons assumes that measurement noise is white, meaning independent from one reading to the next. Such a filter treats the ten fixes as independent anyway. This lesson shows where that goes wrong, and the standard repair.</p>
<p><b>The idea.</b> The lab's receiver adds two errors to the true position. One is a white part, new at every fix ($\sigma_w$ = 0.3 m). The other is a bias that wanders ($\sigma_b$ = 1 m) and loses its memory of earlier values over about $\tau$ = 60 s. The receiver reports $\sigma$ = 1.04 m per axis, which is the true spread of one fix in the open. Fed to the EKF as white measurements, those fixes shrink the filter's $\sigma$ as if every one were fresh evidence. Meanwhile the estimate sits wherever the bias currently puts it. The repair is to give the bias a place in the state. The filter then estimates two more numbers alongside the pose, so that the slow part of the error is modelled instead of averaged.</p>
<p><b>The math.</b> A fix is the position plus the bias plus white noise, and the bias is a first-order Gauss–Markov process:</p>
$$z_k = p_k + b_k + w_k, \qquad b_{k+1} = e^{-\Delta t/\tau}\, b_k + \sigma_b\sqrt{1 - e^{-2\Delta t/\tau}}\;\eta_k$$
<p>Consecutive fixes at 2 Hz share their bias with correlation $e^{-0.5/60} = 0.992$. Over a minute, 120 fixes hold only about one independent sample of the bias, so their average is still about 0.9 m off. A filter that takes them as white claims</p>
$$\sigma_{\bar z} = \frac{\sigma_{rep}}{\sqrt N} = \frac{1.04}{\sqrt{120}} \approx 0.095 \text{ m}.$$
<p>With the bias in the state, $x_a = (x, y, \theta, b_x, b_y)$, the fix is $z = p + b + w$, so $H = [I_2\;\; 0\;\; I_2]$ and $Q = \sigma_w^2 I_2$. The bias is predicted as a random walk, $b_{k+1} = b_k + n_k$, with variance $q\,\Delta t$ per step and $q = 2\sigma_b^2/\tau$.</p>
<p><b>Where it comes from.</b> The 0.095 m is the standard deviation of an average of $N$ independent readings. The 0.9 m comes from summing the bias's correlation over every pair of fixes. For a span much shorter than $\tau$, that sum does not average down at all. The random walk's $q$ matches the Gauss–Markov process's variance growth over short times. <a class="chref" href="#notes=ch2/12-gnss-when-the-noise-is-not-white">Derivation: chapter 2 §12</a></p>
<p><b>What the lab does.</b> The Sensors tab switches GNSS on (it is off by default) and the beacons off, so the fixes are the only position source. Its GNSS section has the rate, the noise, the bias and its time constant, multipath, outages and, for the EKF, the bias in the state. Fixes are drawn on the map. A fix the filter fused is a filled dot, and a fix the gate rejected is a cross. The newest has a dashed ring at the 2σ the receiver reports. The experiments run on the parking lot (L6). The car drives at 0.6 m/s with the odometry noise of L3 (×1, no calibration bias). It laps an 18 × 10 m rectangle on the lot's empty floor, so that you see the error alone. The multipath experiment drives the lane beside the parked cars. The plot shows the position error and its 2σ band, with NEES in a second pane. All numbers below are at seed 7 over 120 s, checked at seeds 3 and 11.</p>

## Try: Dead reckoning on the lot
cfg: {"sim":true,"level":5,"set":{"loc":"dr","odoK":1,"map":"empty","misLoop":true,"vehicles":false},"goals":[[3,13],[21,13],[21,3],[3,3]],"tab":"loc","plot":"pos","panes":[["nees"]]}
Setup: The reference run: dead reckoning on the car's odometry (noise ×1, no bias), with no GNSS and no beacons, lapping the rectangle. The Localize tab is open, with the Position error plot and its 2σ band, and NEES below.
See: The error grows slowly and unevenly: 0.4 m at 20 s, 0.7 m at 30 s, 2.6 m at 100 s and 3.2 m at 120 s. The filter's σ grows with it, from 0.75 m at 20 s to 3.3 m at 120 s, and the error never leaves the 2σ band. NEES stays under 3 (2.7 at most), and the pose RMS is 1.45 m.
Shows: Dead reckoning drifts, and its band grows to match. Its noise is white, so the filter's random walk is the right model and the band is correct. Remember this picture for the next experiment, where the error is smaller but the band no longer covers it.

## Try: GNSS alone
cfg: {"sim":true,"level":5,"set":{"loc":"ekf","bOff":"all","odom":false,"gnss":true,"map":"empty","misLoop":true,"vehicles":false},"goals":[[3,13],[21,13],[21,3],[3,3]],"tab":"sen","plot":"pos","panes":[["nees"]]}
Setup: The EKF with GNSS and nothing else. Wheel odometry is off (Sensors), so the filter predicts with the commanded speed and steering. The fixes are the only position source (2 Hz, with the receiver's reported σ of 1.04 m).
See: The error does not run away as dead reckoning's did, but it wanders as the bias drifts and the car follows the estimate. It is 1.2 m at 20 s, 1.6 m at 40 s, 3.5 m at 80 s and 1.2 m at 120 s. The band stays between 0.45 and 0.7 m (σ 0.22 to 0.36 m) the whole time. The error is inside it a tenth of the time, and NEES climbs from 6 at 20 s to 34 at 40 s and 500 at 100 s. The pose RMS is 2.11 m, and the car touches the outer wall once.
Shows: The error stays bounded, but the band is wrong. Each fix carries 1 m of error, and the filter averages the fixes as if that error were fresh each time. So its σ settles at a few tenths of a metre, while the estimate follows a bias that is a metre or more off. The band rules out an error that large, and the error is there all the same. Seeds 3 and 11 behave the same way, with NEES above 100 and the error inside the band 10 to 60 % of the time. (Seed 3 also loses its heading against the wall, which a filter predicting with commands cannot notice.)
Predict: GNSS alone, fixes of about a metre, two minutes. How does the position error compare with the 2σ band?
- It stays inside, like dead reckoning: the receiver's σ is honest
- It wanders out to a metre or more while the band stays a few tenths of a metre wide
- The band grows without limit, like dead reckoning's
Answer: 1

## Try: GNSS and odometry, the plain EKF
cfg: {"sim":true,"level":5,"set":{"loc":"ekf","bOff":"all","gnss":true,"odoK":1,"map":"empty","misLoop":true,"vehicles":false},"goals":[[3,13],[21,13],[21,3],[3,3]],"tab":"sen","plot":"pos","panes":[["nees"]]}
Setup: The wheel odometry is back on, and the fixes are fused as white measurements with the receiver's σ. This is the textbook GNSS-plus-odometry EKF.
See: The error is a little smaller, with a pose RMS of 1.64 m (2.9 m at worst, around 50 s), and the band a little narrower, σ 0.26 to 0.37 m. NEES in the second pane climbs out of the band. It is 6 at 20 s, 28 at 40 s, 186 at 60 s, and still 51 at the end. The error is inside the 2σ band 11 % of the time.
Shows: Good odometry does not cure the problem. Between fixes the odometry keeps the estimate smooth, which makes the filter more sure of itself. Each fix still pulls the estimate towards a position that is off by the current bias. At seeds 3 and 11 NEES peaks at 207 and 154.
Predict: Add the wheel odometry to the GNSS EKF. What does NEES do in the second pane?
- Settles near 2 or 3: the odometry fixes the problem
- Climbs into the tens, then the hundreds
- Falls below 1: the filter becomes cautious
Answer: 1

## Try: The bias in the state
cfg: {"sim":true,"level":5,"set":{"loc":"ekf","bOff":"all","gnss":true,"gnssAug":true,"odoK":1,"map":"empty","misLoop":true,"vehicles":false},"goals":[[3,13],[21,13],[21,3],[3,3]],"tab":"sen","plot":"pos","panes":[["nees"]]}
Setup: The same run with Localize → Estimate the GNSS bias in the EKF ticked. The filter gets two more states, each a random walk, and $Q$ covers only the white 0.3 m. The GNSS line in the Sensors tab shows the estimated bias against the receiver's true one.
See: NEES stays under 2 for the whole run (1.9 at most), and the error stays inside the band. The error is 0.1 to 0.7 m for the first 80 s and 1.1 m at worst, with a pose RMS of 0.56 m against 1.64 m. The band widens instead of shrinking: σ is 0.31 m at 10 s, 0.84 m at 40 s and 1.46 m at 120 s. The bias estimate follows the true one. At 70 s it is (−0.29, −2.47) m against (−0.25, −2.45) m.
Shows: Once the bias is modelled, the filter's band matches its error. The band widens because the fixes see only position plus bias, and the filter accounts for that. Only the known start and the odometry hold the two apart, and both fade with time. The model makes the filter consistent, but it does not always make it more accurate. At seed 11 the error falls from 1.36 to 0.73 m RMS. At seed 3 it grows from 1.38 to 1.55 m, inside a band that has grown with it. NEES stays in the band at every seed (8.6 at most, at seed 3).
Predict: Now put the bias in the EKF's state. What do NEES and the 2σ band do?
- NEES drops back to a few or below, and the band widens toward a metre or more
- NEES stays in the hundreds: the bias is not observable from the fixes
- The band shrinks to centimetres: the filter now knows the bias exactly
Answer: 0

## Try: Multipath along the parked cars
cfg: {"sim":true,"level":5,"set":{"loc":"ekf","bOff":"all","gnss":true,"gnssAug":true,"odoK":1,"misLoop":true,"vehicles":false},"goals":[[3,11.8],[19,11.8]],"tab":"sen","plot":"pos","panes":[["nees"]],"layers":{"gnss":true}}
Setup: The filter with the bias in its state, on the real lot. The car drives the lane just above the middle row of parked cars, about a metre from them. Within 1.5 m of a wall or a parked car the receiver picks up reflections (multipath). Its fixes jump 2 to 4 m, roughly away from the car, for a few seconds at a time, and it reports the same σ as in the open.
See: Beside the cars the fixes scatter in clumps a few metres off the lane, and the gate crosses many of them out, 18 of the first 40. For 50 s the filter rides through with an error of 0.3 m or less. Then the jumps follow one another so closely that every fix is rejected for 10 s. The filter restarts from the fixes, reflected ones among them, and puts a warning in the event log. The error jumps to 3.8 m at 70 s and stays near 2.5 m, and NEES leaves the band (21 at 70 s, 127 at 110 s). The car reaches one goal in two minutes.
Shows: A reflection is neither white nor slow, so neither model covers it, and the receiver cannot tell that it is happening. The gate is the only defence, and it has a trap of its own. If it rejects everything for long enough, the filter is as lost as a kidnapped robot. It then has to start over from the evidence it was rejecting. Seeds 3 and 11 go the same way: 15 to 21 of the first 40 fixes gated, a restart between 50 and 70 s, and NEES 26 to 64 after it. Untick Multipath in the GNSS settings to see the same lane without it.
Predict: Drive the lane beside the parked cars. What do the fixes look like on the map there?
- The same tight cloud as in the open: GNSS does not care about cars
- Clumps a few metres off, many crossed out by the gate
- No fixes at all: the cars block the sky
Answer: 1

## Try: An outage
cfg: {"sim":true,"level":5,"set":{"loc":"ekf","bOff":"all","gnss":true,"gnssAug":true,"gnssOut":50,"gnssOutLen":15,"odoK":1,"map":"empty","misLoop":true,"vehicles":false},"goals":[[3,13],[21,13],[21,3],[3,3]],"tab":"sen","plot":"pos","panes":[["nees"]]}
Setup: The filter with the bias in its state, in the open again. The receiver is down half the time, in spells of about 15 s (GNSS → outages), as it would be under a bridge, in a tunnel or beside a tall building.
See: The fixes stop at about 34 s and do not come back until about 72 s (two spells back to back). Meanwhile the filter is dead reckoning. The error grows from 0.1 to 2.1 m, and the band widens with it, from σ 0.65 m at 30 s to 2.1 m at 70 s. When the fixes return the band narrows (σ 1.3 m at 80 s), and the error falls to 1.4 m by 90 s. NEES stays under 3 throughout, and the pose RMS is 1.23 m.
Shows: An outage is the easy case, as long as the filter stays consistent. It coasts on odometry, and its band grows to show it. In practice the hard part is the moment the fixes return. The first of them are often multipath, and a filter that has grown overconfident in the meantime gates out the very fixes it needs. At seeds 3 and 11 NEES stays under 4, and the band widens in every outage.
Predict: GNSS is down for half a minute. What does the 2σ band do?
- Stays as it was: the filter remembers the last fixes
- Widens while the fixes are missing and narrows when they return
- Shrinks: no fixes means no noise
Answer: 1

## Code: the GNSS update, with the bias in the state
snippet: ekf-gnss
focus: Pa = aug
focus: hx = aug
focus: R = aug
Note: One function serves both filters. Without the bias, the state is the pose and H picks out x and y. With the bias, the state grows by two, and the predicted fix is the position plus the estimated bias. H then has a second identity block, so the gain splits each innovation between "the car is elsewhere" and "the receiver is off", according to their covariances. The code's R is the measurement noise, $Q$ in the lessons. With the bias in the state, R shrinks to the white part, because the state now carries the bias's variance. The rest is the Joseph-form update used in every other lesson.

## Think about
Q: The receiver reports σ = 1.04 m, and a single fix in the open really is off by about that much. In what sense is the reported σ wrong?
A: It is right about one fix, and says nothing about how the next fix relates to it. The filter needs the joint distribution of all the fixes, and the receiver gives only its diagonal. The correlation is the missing information. With it, the filter would know that the hundredth fix in a minute adds almost nothing to the first. Real receivers make this worse by smoothing their fixes internally, which correlates them further.
Q: With the bias in the state the filter's band grows over the run, even though fixes keep arriving. Is the filter doing something wrong?
A: No. The fixes measure only the sum of position and bias, so nothing in them says how to split the sum. The start pose and the odometry hold the split, and both lose their grip with time. The growing band says, correctly, that GNSS alone cannot tell the car's position from the receiver's error. A beacon fix, a lidar match against a map or a known landmark would pin the split and shrink the band again. Through the cross-covariance, it would also calibrate the bias.
Q: Why does the lab model the bias in the filter as a random walk, when it knows the truth is a Gauss–Markov process with τ = 60 s?
A: A real filter does not know τ well, and a cautious model fails more gently. The exact model bounds the bias's variance at σ_b², which makes the gate tighter. Tried in the lab, it rejected more fixes and lost track at one seed of three. The random walk overstates how far the bias can wander over minutes. The band is then a little wider than it needs to be, and nothing worse happens. Inflating a process noise so that the filter is harder to break is an everyday trade in filter tuning.

## Check yourself
Q: Fixes at 2 Hz, a bias with time constant τ = 60 s. What is the correlation between the biases of two consecutive fixes, $e^{-\Delta t/\tau}$?
Answer: 0.9917
Tolerance: 0.0005
Unit:
How: $\Delta t = 0.5$ s, so $e^{-0.5/60} = e^{-0.00833} = 0.9917$. Consecutive fixes share 99 % of their bias.
