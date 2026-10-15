id: ch1
num: 1
sys: ctl
summary: The vehicle models, from the kinematic unicycle and bicycle to the dynamic bicycle model with tyre slip, all three of which the lab simulates: derivations, the understeer gradient, the characteristic speed, stability, and where the kinematic model stops being true.

# Vehicle models: from kinematics to dynamics

Every planner and tracker in this lab assumes a model of how the vehicle moves when commanded. The lab simulates two kinematic models, the unicycle for the diff-drive robot and the bicycle for the car, wraps them in an actuation chain of delays, lags and limits, and offers a third vehicle with tyres that slip, the dynamic bicycle model of §4 (Vehicle → Car (dynamic: tyre slip)); right now you are driving {{live:vehNow}}. Those models are exact for slow vehicles whose wheels roll without slipping, and they are what chapters 4 to 7 build on. A car at road speed is a different object: its tyres slip, its mass and yaw inertia matter, and the relationship between steering and turning changes with speed in ways the kinematic model cannot represent. This chapter derives both, in order: the unicycle (§1), the actuation chain (§2), the kinematic bicycle (§3), the dynamic bicycle model with linear tyres (§4), what it predicts about steady cornering, the characteristic speed and stability (§5), and the limits that mark where one model hands over to the other (§6). The blue numbers follow your settings where the lab has them: the car's wheelbase is {{live:wheelbase}} m with a steering lock of {{live:steerMaxDeg}}°, so its tightest turn has radius {{live:Rmin}} m; at the operating speed of {{live:v0}} m/s a turn at the planning radius of {{live:Rplan}} m pulls {{live:ayPlan}} m/s² of lateral acceleration, against a cap of {{live:alat}} m/s².

## 1. The unicycle

**The model.** The differential-drive robot has two driven wheels on one axle. Commanding their speeds commands a forward speed $v$ and a turn rate $\omega$ about the axle's midpoint, and nothing else: the body cannot move sideways. Its pose $(x, y, \theta)$ evolves by

$$
\dot x = v\cos\theta, \qquad \dot y = v\sin\theta, \qquad \dot\theta = \omega
$$

This is the unicycle, and it is the model every localization filter in chapter 2 integrates. Over one tick with $v$ and $\omega$ held constant the solution is an arc of radius $v/\omega$, which the lab integrates exactly (the arc model of chapter 2 §2) rather than by Euler steps, so that a circle driven for a full turn closes.

**What makes it a robot and not a point.** The lab's unicycle has a radius of 0.3 m for collision, a maximum speed, a maximum turn rate of 1.8 rad/s, and optional acceleration limits on both; it can turn in place, which is why the planners for it need no heading in their state. The one thing it cannot do is move sideways, the nonholonomic constraint $\dot y\cos\theta - \dot x\sin\theta = 0$, and that constraint is what makes path tracking a control problem rather than a lookup: the robot must turn to move across.

## 2. The actuation chain

A command does not become motion at once. The lab applies, in order, the same things a real drivetrain does:

| Stage | What it does | Where it is set |
| --- | --- | --- |
| Control latency | the command waits a whole number of 50 ms ticks in a queue | Vehicle tab |
| Saturation | $v$, $\omega$ or δ are clipped to their limits | Vehicle tab |
| First-order lag | the actuator approaches the clipped command with time constant τ, $\dot u = (u_{\text{cmd}} - u)/\tau$ | Vehicle tab |
| Acceleration limits | $\dot v$ and (diff-drive) $\dot\omega$ are bounded | Vehicle tab, "accel" |
| Steering rate (car) | δ moves at most 1.5 rad/s | Vehicle tab |
| Bias | a constant offset: steering misalignment in degrees, or a turn-rate offset | Vehicle tab |

Each stage is a lesson in chapter 6: latency is a pure phase loss $\omega T$, the lag is a pole at $-1/\tau$, the limits are where the linear analysis stops, the bias is what integral action removes. Chapter 7's MPC can carry the lag in its model and the lessons show what that is worth. Everything in this chain is also what separates the command the controller sends from the motion the estimator measures, which is why the MPC's analysis reads a gain on the actuator state separately from its gains on the errors.

## 3. The kinematic bicycle

**The derivation.** Collapse a car's two front wheels into one at the front axle and the two rear wheels into one at the rear, a bicycle, and assume neither wheel slips sideways: each wheel's velocity points along the wheel. Take the reference point at the rear axle, moving at speed $v$ along the heading θ. The front wheel, a wheelbase $L$ ahead, is steered by δ, so its velocity points along $\theta + \delta$; but it is also rigidly attached, so its velocity is the rear point's velocity plus $L\dot\theta$ perpendicular to the body. Equating the perpendicular components:

$$
L\,\dot\theta = v\tan\delta \quad\Longrightarrow\quad \dot\theta = \frac{v\tan\delta}{L}, \qquad R = \frac{L}{\tan\delta}
$$

With $\dot x = v\cos\theta$, $\dot y = v\sin\theta$ the model is the unicycle with its turn rate tied to speed and steering. The turning radius at full lock is $R_{\min} = L/\tan\delta_{\max}$ = {{live:Rmin}} m for the lab's car, and the car cannot turn at all when stopped, which is the whole difference between the planners of chapter 4 §4 and the grid planners before them.

**Why the rear axle.** The rear wheel's no-slip condition says the rear point moves along the heading exactly; the front point does not (it moves along $\theta + \delta$), and the centre of mass moves along $\theta + \beta$ with a sideslip angle $\beta = \arctan(l_r\tan\delta/L)$, up to {{live:betaMax}}° at full lock for the lab's geometry. Referencing the rear axle keeps the kinematics in unicycle form, which is why the trackers of chapter 5 can share one set of path coordinates, and why on a reverse leg the same equations hold with the heading flipped.

**What the lab adds.** The steering angle is a state with a rate limit (1.5 rad/s) and a lock (32°), the body is a 0.9 × 0.5 m rectangle for collision (three covering circles for planning), and the speed profile caps $v^2\kappa$ at the lateral-acceleration slider, §6. Nothing else: no mass, no tyres, no slip. The kinematic car, *Car (kinematic)* in the Vehicle tab, always goes exactly where its front wheel points; the third option, *Car (dynamic: tyre slip)*, is the model of the next section.

## 4. The dynamic bicycle model

**Why kinematics is not enough.** A real tyre produces lateral force only by slipping: the contact patch deforms, the wheel travels at a small angle to the direction it points, and the force is roughly proportional to that angle, the slip angle $\alpha$, with a cornering stiffness $C$ (in N/rad) up to a limit set by friction. So at any speed where the lateral force needed to turn is appreciable, the wheels do not go where they point, and the vehicle's turn depends on its mass, its inertia and its tyres, not only on its geometry.

**The model.** Keep the bicycle, put the reference at the centre of mass, hold the forward speed $v_x$ constant (the longitudinal dynamics decouple to first order), and take as states the lateral velocity $v_y$ and the yaw rate $r$. Newton's second law in the body frame, where the lateral acceleration is $\dot v_y + v_x r$ (the second term is the centripetal part of turning), and the moment balance about the centre of mass:

$$
m\,(\dot v_y + v_x r) = F_{yf} + F_{yr}, \qquad I_z\,\dot r = l_f F_{yf} - l_r F_{yr}
$$

The slip angle at each axle is the angle between where the wheel points and where it moves. The front wheel points at δ relative to the body and moves with lateral velocity $v_y + l_f r$ (the body's lateral velocity plus the yaw rate's contribution at $l_f$ ahead); the rear wheel points straight and moves with $v_y - l_r r$:

$$
\alpha_f = \delta - \frac{v_y + l_f r}{v_x}, \qquad \alpha_r = -\frac{v_y - l_r r}{v_x}, \qquad F_{yf} = C_f\,\alpha_f, \quad F_{yr} = C_r\,\alpha_r
$$

(small angles throughout). Substitute and collect: a linear state-space model whose matrices depend on the speed,

$$
\begin{bmatrix} \dot v_y \\ \dot r \end{bmatrix} =
\begin{bmatrix} -\dfrac{C_f + C_r}{m v_x} & -v_x - \dfrac{l_f C_f - l_r C_r}{m v_x} \\[8pt] -\dfrac{l_f C_f - l_r C_r}{I_z v_x} & -\dfrac{l_f^2 C_f + l_r^2 C_r}{I_z v_x} \end{bmatrix}
\begin{bmatrix} v_y \\ r \end{bmatrix} +
\begin{bmatrix} \dfrac{C_f}{m} \\[6pt] \dfrac{l_f C_f}{I_z} \end{bmatrix} \delta
$$

This is the linear bicycle model (Rajamani's *Vehicle Dynamics and Control* is the standard reference). The kinematic model of §3 is its limit as the stiffnesses go to infinity: with no slip allowed, the slip angles must be zero, which gives $v_y = l_r r$ and $r = v_x\tan\delta/L$ directly.

**Two cars.** The table below is for a representative passenger car: $m$ = 1500 kg, $I_z$ = 2500 kg·m², $l_f$ = 1.2 m, $l_r$ = 1.5 m ($L$ = 2.7 m), $C_f$ = 80 kN/rad, $C_r$ = 100 kN/rad. The lab's car with tyre slip is much smaller: right now $m$ = {{live:dynM}} kg, $I_z$ = {{live:dynIz}} kg·m², $l_f$ = {{live:dynLf}} m and $l_r$ = {{live:dynLr}} m ($L$ = {{live:wheelbase}} m), $C_f$ = {{live:dynCf}} N/rad, $C_r$ = {{live:dynCr}} N/rad, μ = {{live:dynMu}} (Vehicle tab; the Grippy preset unless you changed it). The eigenvalues of the matrix above, which are the vehicle's own yaw dynamics before any controller, for the passenger car:

| $v_x$ [m/s] | eigenvalues [1/s] | $\omega_n$ [rad/s] | ζ | $r/\delta$ dynamic [1/s] | $r/\delta$ kinematic $v/L$ | ratio |
| --- | --- | --- | --- | --- | --- | --- |
| 5 | −22, −29 | 25 | 1.0 | 1.79 | 1.85 | 0.97 |
| 10 | −12.8 ± 3.6j | 13.3 | 0.96 | 3.25 | 3.70 | 0.88 |
| 20 | −6.4 ± 4.4j | 7.8 | 0.82 | 4.76 | 7.41 | 0.64 |
| 30 | −4.3 ± 4.6j | 6.2 | 0.68 | 4.94 | 11.1 | 0.44 |

At 5 m/s the yaw response is overdamped and fast (time constant under 50 ms) and the steady gain is within 3 % of kinematic: the kinematic model is fine. At 30 m/s the vehicle's own yaw mode has a natural frequency of 6 rad/s with ζ = 0.68, it rings for a quarter of a second after a steering input, and the steady gain is less than half of what geometry predicts. Any tracker tuned on the kinematic model at that speed has the wrong plant gain by a factor of two and an unmodeled second-order mode near its crossover.

**The lab's car.** Shrinking the car does not shrink the effect; the understeer gradient depends only on how hard each axle's tyres are worked for their load, $K_{us} = (1/g)(F_{zf}/C_f - F_{zr}/C_r)$, so the lab's characteristic speed is set by its tyres alone. With realistic grippy tyres (about 9 and 16 N/rad per newton of load) it is 11.5 m/s, far above anything the lab drives, and the dynamics are invisible. The *Slippery floor* preset uses tyres soft enough to put it at 2.6 m/s, so everything in this chapter happens at lab speeds:

| preset | $C_f$, $C_r$ [N/rad] | μ | $K_{us}$ [rad/(m/s²)] | $v_{ch}$ [m/s] | μ$g$ [m/s²] | eigenvalues at 1 / 2 / 4 m/s [1/s] | $r/\delta$ ÷ $v/L$ at 1 / 2 / 4 m/s |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Grippy | 500, 700 | 0.9 | 0.0046 | 11.5 | 8.83 | −92, −153 / −49, −74 / −30.7 ± 6.5j | 0.99 / 0.97 / 0.89 |
| Slippery floor | 40, 90 | 0.25 | 0.0875 | 2.62 | 2.45 | −9.2, −17.9 / −6.8 ± 3.3j (ζ 0.90) / −3.4 ± 4.3j (ζ 0.62) | 0.87 / 0.63 / 0.30 |

Both use $m$ = 10 kg, $I_z$ = 0.9 kg·m², $l_f$ = 0.27 m. The simulator integrates the model in 20 substeps of 2.5 ms per 50 ms tick (the grippy yaw mode has time constants of a few milliseconds at low speed), with the pose still at the rear axle, which moves at $(v_x,\ v_y - l_r r)$ in body axes. Below 0.3 m/s, where the slip angles lose their meaning, it blends to the kinematic model, and in reverse the slip angles change sign so the tyres still oppose the sliding. [try: Slippery floor at 1.5 m/s | {"sim":true,"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"vmax":2,"vcruise":1.5,"alat":1.5},"plot":"cte","panes":[["yawr","yawk"],["beta"]],"layers":{"slip":true}}] [try: Same run, kinematic car | {"sim":true,"level":0,"set":{"veh":"car","vmax":2,"vcruise":1.5,"alat":1.5},"plot":"cte"}]

## 5. Understeer, the characteristic speed and stability

**Steady cornering.** Set the derivatives to zero and solve the state equation for the steady yaw rate per unit of steering. After some algebra the result has a clean form:

$$
\frac{r}{\delta}\Big|_{ss} = \frac{v_x}{L + K_{us}\,v_x^2}, \qquad K_{us} = \frac{m}{L}\left(\frac{l_r}{C_f} - \frac{l_f}{C_r}\right)
$$

$K_{us}$ is the understeer gradient. It has units of rad per m/s² and a direct meaning: the extra steering angle, beyond the kinematic $L/R$, needed per unit of lateral acceleration to hold a turn. It is positive when the front tyres run at a larger slip angle than the rears for a given lateral acceleration, which, from the formula, happens when $l_r/C_f > l_f/C_r$: front-heavy weight distribution or softer front tyres. For the reference car $K_{us}$ = 0.00375 rad/(m/s²), 0.21° per m/s², understeering, as nearly every production car is made to be.

**The characteristic speed.** For an understeering car the yaw-rate gain rises with speed, peaks, and falls, because the denominator's $K_{us}v_x^2$ term eventually dominates. The peak is at the characteristic speed

$$
v_{ch} = \sqrt{L / K_{us}} = \text{26.8 m/s for the reference car}
$$

at which the gain is exactly half of kinematic. Below $v_{ch}$ the car turns more for each unit of steering as speed rises, as the kinematic model says; above it, less. That is why the table's ratio column falls from 0.97 to 0.44, and why a gain schedule built on the kinematic plant gain $v/L$ (the subject of the gain-scheduling lesson) is wrong by that ratio at speed.

For the lab's car with the current tyre settings: $K_{us}$ = {{live:Kus}} rad/(m/s²) ({{live:KusDeg}}° per m/s²), characteristic speed {{live:vch}} m/s, grip limit μ$g$ = {{live:mug}} m/s². At the operating speed of {{live:v0}} m/s its yaw gain is {{live:grPct}} % of $v/L$, its yaw mode has {{live:yawMode}}, and the grip runs out on turns tighter than {{live:Rgrip}} m. [try: Slippery floor in Analyze, 2 m/s | {"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"ctl":"pp","vmax":4,"vcruise":2}}]

**Stability.** The matrix in §4 has a negative trace at every speed, so stability is decided by its determinant, which works out to

$$
\det A = \frac{1}{I_z}\left(\frac{C_f C_r L^2}{m v_x^2} + l_r C_r - l_f C_f\right)
$$

The second term has the sign of $K_{us}$. For an understeering car it is positive, the determinant is positive at every speed, and the yaw dynamics are stable however fast the car goes. For an oversteering car, $K_{us} < 0$, the determinant falls with speed and crosses zero at the critical speed

$$
v_{crit} = \sqrt{-L / K_{us}}
$$

above which one eigenvalue is positive: a yaw disturbance grows on its own, and the car spins unless the driver, or the controller, catches it. The lab's car oversteers with the slippery floor's stiffnesses swapped ($C_f$ = 90, $C_r$ = 40 N/rad): $v_{crit}$ = 3.42 m/s, and at 4 m/s its yaw mode has a pole at +0.49 1/s. Analyze counts it in the Nyquist criterion (P = 1). Pure pursuit with its default lookahead does not stabilize that car (phase margin −28°, Z = 2), while Stanley, whose crossover is higher, does with 12.7° to spare. [try: Oversteering car, pure pursuit, 4 m/s | {"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":90,"Cr":40,"mu":0.25,"ctl":"pp","vmax":4,"vcruise":4}}] [try: Same, Stanley | {"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":90,"Cr":40,"mu":0.25,"ctl":"stanley","vmax":4,"vcruise":4}}] Swap the reference car's weight distribution and stiffnesses ($l_f$ = 1.5, $l_r$ = 1.2, $C_f$ = 100, $C_r$ = 80 kN/rad) and it oversteers with the same magnitude of gradient: eigenvalues −7.3 and −18 at 10 m/s, −0.33 and −9.9 at 25 m/s, and +0.48 at 30 m/s, past its critical speed of 26.8 m/s. This is the vehicle-dynamics fact behind "oversteer is for racing drivers": the open-loop plant is unstable, and the loop around it, driver or controller, has to supply the stability that the understeering car has built in.

**What this does to the loop of chapter 6.** The kinematic plant from steering to heading rate is a gain, $v/L$. The dynamic plant is a gain that depends on speed through $K_{us}$ times a second-order lag with the eigenvalues of §4, so the open loop of chapter 6 §3 acquires two more poles and a speed-dependent gain. Below $v_{ch}/3$ or so the poles are fast and well damped and the gain is within 10 % of kinematic, and everything in chapter 6 applies with the kinematic numbers. Near and above $v_{ch}$ the extra poles are within a decade of the lateral loop's crossover, cost phase there, and the gain is off by a factor approaching two; a controller designed on the kinematic model will be slower than designed, or ring. Production lane-keeping controllers are scheduled on speed with the dynamic model, for this reason. In the lab this is no longer only an argument: with the car with tyre slip selected, Analyze puts the linear model of §4 between the steering and the heading, and the lesson *Gain scheduling breaks above v_ch* shows pure pursuit's speed schedule losing its damping on the slippery floor (ζ 0.71 at every speed on the kinematic car, 0.25 at 4 m/s with the tyres) and rear-wheel feedback's default gains left with 0.3° of phase margin at 2 m/s. [try: Rear-wheel feedback on the slippery floor, 2 m/s | {"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"ctl":"rwf","vmax":4,"vcruise":2},"test":"step","stepKind":"offset","stepAmp":0.05}]

## 6. The limits, and where the kinematic model stops

**Tyre saturation.** The linear tyre, $F = C\alpha$, holds for slip angles up to a few degrees. Beyond that the force rises more slowly and then falls, and its magnitude can never exceed what friction allows: $|F| \le \mu F_z$, with $\mu$ around 0.9 on dry asphalt and 0.3 on wet or icy surfaces. Lateral and longitudinal forces share that budget (the friction circle), so a tyre braking hard has little lateral force left. In terms the planner can use, the total lateral acceleration a vehicle can sustain is about $\mu g$: 9 m/s² dry, 3 m/s² wet, less on a loaded vehicle whose inside tyres unload in a turn.

**The lab's stand-in.** The kinematic car never slips, so left alone it would take any corner at any speed. The speed profile of chapter 5 §1 imposes the missing physics as a cap on the lateral acceleration $v^2\kappa$:

$$
v \le \sqrt{a_{\text{lat}} / \kappa}, \qquad a_{\text{lat}} = \text{{{live:alat}} m/s² (Control tab)}
$$

That is the single number that stands for tyres, friction and load transfer in this lab, and it is what the Experiments tab varies when you ask how fast a route can be driven. At the planning radius of {{live:Rplan}} m and the operating speed of {{live:v0}} m/s the lab's car pulls {{live:ayPlan}} m/s², {{live:ayFrac}} % of the cap. The cap is honest as far as it goes: a vehicle that keeps $v^2\kappa$ well below $\mu g$ stays in the linear tyre regime where the models above hold. With the kinematic car nothing checks the cap against the tyres. The car with tyre slip clips each axle's force at μ times its static load, so a cap above μ$g$ (now {{live:mug}} m/s²) is a promise the floor does not keep. On the slippery floor at 2 m/s with the cap at 6 m/s², the front tyres saturate, the car pushes wide of the first sharp turn and hits a pillar, which is the lesson *Running out of grip*. [try: Cap above the grip | {"sim":true,"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"vmax":2.5,"vcruise":2,"alat":6},"plot":"cte","panes":[["ay","mug"]],"layers":{"slip":true,"trail":true}}]

**When the kinematic model is enough.** Three conditions, all of them met by the lab's robots and none of them by a car on a motorway:

- Lateral acceleration well below the friction limit, say under 0.3 g, so that the slip angles are a degree or two and the tyres are linear.
- Speed well below the characteristic speed, so that the steady yaw gain is within 10 % of $v/L$.
- The vehicle's yaw mode much faster than the loop: the §4 eigenvalues at least a decade above the tracker's crossover, so that the yaw dynamics look instantaneous to the controller.

At 0.8 m/s with a 0.6 m wheelbase every one of these holds by a wide margin, which is why chapter 6 can analyze the lab's loops with a two-integrator plant and get the simulator's step responses to within a percent. At 20 m/s with a 2.7 m wheelbase the first condition holds in a lane change and fails in an emergency swerve, the second is marginal, and the third fails: the yaw mode at 7.8 rad/s sits right where a lateral loop would like to cross over. That is the regime where the dynamic bicycle model, and controllers designed on it, take over.

**What the lab leaves out.** The kinematic car has no body sideslip, so the centre of mass goes where the rear axle goes, and no yaw inertia, so steering changes the turn rate at once (only the steering-rate limit slows it). The car with tyre slip adds both: the model of §4 with linear tyres clipped at μ$F_z$. It still leaves out load transfer (the static axle loads never change), combined slip (braking and cornering do not share a friction circle; speed follows the command as for the other vehicles), a tyre curve that falls beyond its peak, suspension, and any dynamics in the planners, trackers and MPC, which keep the kinematic model on purpose, so that the lessons can show what the mismatch costs. Its odometry takes the turn rate from the steering encoder, $v\tan\delta/L$, so slip appears as odometry error, unless the yaw-rate gyro is on (Vehicle tab).

## 7. What to carry into the next chapters

The kinematic models are the ones the chapters after this use, and they use them correctly: at the lab's speeds the no-slip assumption is accurate, the two-integrator plant of chapter 6 follows from it in two lines, and the trackers of chapter 5 need only the geometry. What this chapter adds is the boundary. Every result that depends on $v/L$ as the plant gain, every delay margin computed with a kinematic crossover, every gain schedule built on speed alone, holds up to a lateral acceleration and a speed that the dynamic model names, $\mu g$ and $v_{ch}$, and the two numbers to keep in mind when carrying anything from this lab to a vehicle that can actually go fast.
