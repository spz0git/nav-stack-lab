group: intro
title: The robot's uncertainty is a number too
level: 1

<p><b>Why this matters.</b> A position estimate is only half an answer. A robot that is 5 cm off and knows it can drive down a 1 m aisle; a robot that is 5 cm off but believes it could be 2 m off should stop; a robot that is 50 cm off and believes it is exact will drive into the shelf. So the filter reports how sure it is, and the rest of the stack depends on that number being honest. This lesson shows how to check it.</p>
<p><b>The idea.</b> Next to its estimate the filter keeps a <i>covariance</i>: how uncertain each part of the estimate is, and how the errors move together. Its square roots are standard deviations, written σ. If the errors behave like a normal (Gaussian) distribution, the true error lies within 2σ about 95 % of the time. The lab draws this on the Position error plot as the 2σ band, and on the map as an ellipse around the robot. A filter whose band matches its real errors, so the error stays inside about 19 times out of 20, is called <i>consistent</i>. A filter whose band is too narrow, so the error often pokes out, is <i>overconfident</i>: it trusts itself more than it should. A band that is far too wide is honest but not much use.</p>
<p>The lab also condenses this into one number, NEES. It measures each error in units of the filter's own σ, squares it, and adds up position and heading. For a consistent filter it averages about 3. Well above 3 means overconfident; the lab flags it above 7.8.</p>
<p><b>What the lab does.</b> The laps of the last two lessons with the EKF. The Position error plot shows the true error as a line and the 2σ band as a shaded area. The Metrics list beside the event log shows NEES, averaged over the last 20 s. The second experiment triples the calibration bias, a wheel-size error the filter is not told about.</p>
<p><b>Where it comes from.</b> In one dimension, the error measured in standard deviations, $e/\sigma$, has mean square 1 when $\sigma$ is right. NEES does the same for the three numbers of a pose:</p>
$$\text{NEES} = \mathbf e^\top \Sigma^{-1} \mathbf e$$
<p>Here $\mathbf e$ is the error in $x$, $y$ and heading and $\Sigma$ the covariance; the average is 3, one for each number. Above 7.8 happens only 5 % of the time for a consistent filter. Go deeper: <a class="lsref" href="#lesson=loc:2">The Kalman update, and NEES as a lie detector</a> · <a class="chref" href="#notes=ch2/5-consistency-nees-and-the-2-band">consistency, NEES and the 2σ band: chapter 2 §5</a></p>

## Try: EKF: the band and the error
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","map":"empty","misLoop":true},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"loc","plot":"pos"}
Setup: The EKF laps of the last lesson: noise ×1, bias ×1, beacons within 7 m.
See: The band is narrow, about 5 cm, because the beacons keep the filter sure of itself. The error line stays mostly inside it and pokes out now and then: inside 95 % of the time over two minutes. NEES in the Metrics list wanders between about 2.5 and 4.
Shows: This filter is consistent: its band and its errors agree. On seeds 1 to 4 the error is inside the band 93 to 97 % of the time. A small bias is in the odometry, but the beacon readings correct it faster than it can build up.
Predict: How often will the error line poke above the band?
- Never: the band is a hard limit on the error
- Now and then, roughly one moment in twenty
- Most of the time: the band is only a rough guide
Answer: 1

## Try: Bias ×3, the filter not told
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","map":"empty","misLoop":true,"odoB":3},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"sen","plot":"pos"}
Setup: The same laps with the calibration bias at ×3 (Sensors tab, Odometry). The filter's model of the odometry is unchanged, so it does not know about the extra error.
See: The band is as narrow as before, about 5 cm, and the error is still only a few centimetres. But it now sits above the band much more often: inside only 70 % of the time over two minutes. NEES rises to between 4 and 9, and is flagged as overconfident when it passes 7.8.
Shows: The band comes from what the filter believes about its sensors, not from the errors it actually makes. When the robot has an error the filter does not model, the band stays narrow and the error leaves it: the filter is overconfident. Here the beacons still keep the error small, so the robot is fine; on a long stretch without beacons the same filter would be wrong and sure of itself. On seeds 1 to 4 the error is inside the band only 53 to 74 % of the time.
Predict: The bias triples, and the filter is not told. What happens on the plot?
- The band widens to cover the extra error
- The band stays narrow, and the error is outside it far more often
- The error grows to metres, as with dead reckoning
Answer: 1

## Think about
Q: A filter that reports a 2σ band of ±10 m is almost always consistent. Why is that not good enough?
A: Consistency only says that the band is honest, not that it is small. A robot that knows it is somewhere within 10 m cannot plan through a 2 m aisle. You want both: a small error and a band that matches it. In lesson 2, dead reckoning's position error stayed inside its band nearly all the time, and that band was metres wide.

## Check yourself
Q: In the first experiment, how wide is the 2σ band on the Position error plot, measured from zero to its top edge?
Answer: 5
Tolerance: 1
Unit: cm
How: The band's top edge stays at about 0.05 m, 5 cm, for the whole run: with a beacon reading every fifth of a second, the filter's uncertainty never has time to grow.
