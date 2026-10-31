id: ch1
num: 1
sys: ctl
summary: The vehicle models, from the kinematic unicycle and bicycle to the dynamic bicycle model with tyre slip, all three of which the lab simulates: derivations, the understeer gradient, the characteristic speed, stability, and where the kinematic model stops being true.

# Vehicle models: from kinematics to dynamics

Every planner and tracker in this lab assumes a model of how the vehicle moves when it is given a command. The lab simulates two kinematic models. The unicycle models the diff-drive robot and the bicycle models the car, and each is wrapped in an actuation chain of delays, lags and limits. A third vehicle has tyres that slip. It runs the dynamic bicycle model of §4 (Vehicle → Car (dynamic: tyre slip)). Right now you are driving {{live:vehNow}}. The kinematic models are exact for slow vehicles whose wheels roll without slipping, and chapters 4 to 7 build on them. A car at road speed behaves differently. Its tyres slip, its mass and yaw inertia matter, and the way steering turns the car changes with speed in ways the kinematic model cannot represent. This chapter derives both kinds of model in order. §1 is the unicycle, §2 the actuation chain and §3 the kinematic bicycle. §4 is the dynamic bicycle model with linear tyres, and §5 is what it predicts about steady cornering, the characteristic speed and stability. §6 gives the limits where one model hands over to the other. The blue numbers follow your settings where the lab has them. The car's wheelbase is {{live:wheelbase}} m with a steering lock of {{live:steerMaxDeg}}°, so its tightest turn has radius {{live:Rmin}} m. At the operating speed of {{live:v0}} m/s, a turn at the planning radius of {{live:Rplan}} m pulls {{live:ayPlan}} m/s² of lateral acceleration, against a cap of {{live:alat}} m/s².

## 1. The unicycle

**The model.** The differential-drive robot has two driven wheels on one axle. Setting the two wheel speeds sets a forward speed $v$ and a turn rate $\omega$ about the axle's midpoint. Nothing else can be commanded, and the body cannot move sideways. Its pose $(x, y, \theta)$ evolves by

$$
\dot x = v\cos\theta, \qquad \dot y = v\sin\theta, \qquad \dot\theta = \omega
$$

This is the unicycle. Every localization filter in chapter 2 integrates it. Over one tick with $v$ and $\omega$ held constant, the solution is an arc of radius $v/\omega$. The lab integrates that arc exactly (the arc model of chapter 2 §2) instead of taking Euler steps, so a circle driven for a full turn closes.

**What makes it a robot and not a point.** The lab's unicycle is a disc of radius 0.3 m for collision. It has a maximum speed, a maximum turn rate of 1.8 rad/s, and optional acceleration limits on both. It can turn in place, so the planners for it need no heading in their state. It cannot move sideways. This is the nonholonomic constraint $\dot y\cos\theta - \dot x\sin\theta = 0$. Because of it, a tracker cannot just look up the next point on the path and move there. The robot has to turn before it can move across, and that makes path tracking a control problem.

## 2. The actuation chain

A command does not become motion at once. The lab applies the same stages a real drivetrain does, in this order:

| Stage | What it does | Where it is set |
| --- | --- | --- |
| Control latency | the command waits a whole number of 50 ms ticks in a queue | Vehicle tab |
| Saturation | $v$, $\omega$ or δ are clipped to their limits | Vehicle tab |
| First-order lag | the actuator approaches the clipped command with time constant τ, $\dot u = (u_{\text{cmd}} - u)/\tau$ | Vehicle tab |
| Acceleration limits | $\dot v$ and (diff-drive) $\dot\omega$ are bounded | Vehicle tab, "accel" |
| Steering rate (car) | δ moves at most 1.5 rad/s | Vehicle tab |
| Bias | a constant offset: steering misalignment in degrees, or a turn-rate offset | Vehicle tab |

Each stage comes back in the lessons of chapter 6. Latency is a pure phase loss $\omega T$. The lag is a pole at $-1/\tau$. The limits mark where the linear analysis stops, and the bias is what integral action removes. Chapter 7's MPC can carry the lag in its model, and its lessons show what that is worth. This chain is also what separates the command the controller sends from the motion the estimator measures. For that reason the MPC's analysis reads its gain on the actuator state separately from its gains on the errors.

## 3. The kinematic bicycle

**The derivation.** Replace a car's two front wheels with one wheel at the middle of the front axle, and its two rear wheels with one at the middle of the rear axle. The result is a bicycle. Assume that neither wheel slips sideways, so each wheel's velocity points along the wheel. Take the reference point at the rear axle, moving at speed $v$ along the heading θ. The front wheel sits a wheelbase $L$ ahead and is steered by δ, so its velocity points along $\theta + \delta$. It is also rigidly attached to the body, so its velocity is the rear point's velocity plus $L\dot\theta$ perpendicular to the body. Its component along the body is then $v$ and its component across the body is $L\dot\theta$. For the velocity to point along $\theta + \delta$, the ratio of the two must be $\tan\delta$:

$$
L\,\dot\theta = v\tan\delta \quad\Longrightarrow\quad \dot\theta = \frac{v\tan\delta}{L}, \qquad R = \frac{L}{\tan\delta}
$$

With $\dot x = v\cos\theta$, $\dot y = v\sin\theta$ the model is the unicycle with its turn rate tied to speed and steering. The turning radius at full lock is $R_{\min} = L/\tan\delta_{\max}$ = {{live:Rmin}} m for the lab's car. The car cannot turn at all when it is stopped. That is the whole difference between the planners of chapter 4 §4 and the grid planners before them.

**Why the rear axle.** By the rear wheel's no-slip condition, the rear point moves along the heading. The front point moves along $\theta + \delta$ instead. The centre of mass moves along $\theta + \beta$, where the sideslip angle is $\beta = \arctan(l_r\tan\delta/L)$. It reaches {{live:betaMax}}° at full lock with the lab's $l_r = L - l_f$ = {{live:lr}} m (the geometry of the car with tyre slip, §4). Taking the reference at the rear axle keeps the kinematics in unicycle form. So the trackers of chapter 5 can share one set of path coordinates, and on a reverse leg the same equations hold with the heading flipped.

**What the lab adds.** The steering angle is a state with a rate limit (1.5 rad/s) and a lock (32°). The body is a 0.9 × 0.5 m rectangle for collision, covered by three circles for planning. The speed profile caps $v^2\kappa$ at the lateral-acceleration slider (§6). The model has no mass, no tyres and no slip. The kinematic car, *Car (kinematic)* in the Vehicle tab, always goes where its front wheel points. The third option, *Car (dynamic: tyre slip)*, is the model of the next section.

## 4. The dynamic bicycle model

**Why kinematics is not enough.** A real tyre produces lateral force only by slipping. The contact patch deforms, and the wheel travels at a small angle to the direction it points. That angle is the slip angle $\alpha$. The force is roughly proportional to it, up to a limit set by friction, and the constant of proportionality is the cornering stiffness $C$ (in N/rad). So at any speed where turning needs an appreciable lateral force, the wheels do not go where they point. The vehicle's turn then depends on its mass, its inertia and its tyres as well as on its geometry.

**The model.** Keep the bicycle and put the reference point at the centre of mass. Hold the forward speed $v_x$ constant, since to first order the longitudinal dynamics decouple from the lateral ones. The states are the lateral velocity $v_y$ and the yaw rate $r$. In the body frame the lateral acceleration is $\dot v_y + v_x r$, where the second term is the centripetal part of turning. Newton's second law across the body and the moment balance about the centre of mass are then

$$
m\,(\dot v_y + v_x r) = F_{yf} + F_{yr}, \qquad I_z\,\dot r = l_f F_{yf} - l_r F_{yr}
$$

The slip angle at each axle is the angle between where the wheel points and where it moves. The front wheel points at δ relative to the body. It moves with lateral velocity $v_y + l_f r$, which is the body's lateral velocity plus the yaw rate's contribution at $l_f$ ahead. The rear wheel points straight ahead and moves with lateral velocity $v_y - l_r r$. Each lateral velocity divided by $v_x$ is the angle at which that wheel moves, so

$$
\alpha_f = \delta - \frac{v_y + l_f r}{v_x}, \qquad \alpha_r = -\frac{v_y - l_r r}{v_x}, \qquad F_{yf} = C_f\,\alpha_f, \quad F_{yr} = C_r\,\alpha_r
$$

All angles are taken as small. The simulator and the MPC of chapter 7 write $\tan\delta$ for δ, which is the same to first order, so that with no slip the car turns at the kinematic rate $v\tan\delta/L$. Substituting the forces into the two equations of motion and collecting terms gives a linear state-space model whose matrices depend on the speed:

$$
\begin{bmatrix} \dot v_y \\ \dot r \end{bmatrix} =
\begin{bmatrix} -\dfrac{C_f + C_r}{m v_x} & -v_x - \dfrac{l_f C_f - l_r C_r}{m v_x} \\[8pt] -\dfrac{l_f C_f - l_r C_r}{I_z v_x} & -\dfrac{l_f^2 C_f + l_r^2 C_r}{I_z v_x} \end{bmatrix}
\begin{bmatrix} v_y \\ r \end{bmatrix} +
\begin{bmatrix} \dfrac{C_f}{m} \\[6pt] \dfrac{l_f C_f}{I_z} \end{bmatrix} \delta
$$

This is the linear bicycle model. The standard reference is Rajamani's *Vehicle Dynamics and Control*. The kinematic model of §3 is its limit as the stiffnesses go to infinity. With no slip allowed, both slip angles must be zero, and that gives $v_y = l_r r$ and $r = v_x\tan\delta/L$ directly.

**Two cars.** The table below is for a representative passenger car with $m$ = 1500 kg, $I_z$ = 2500 kg·m², $l_f$ = 1.2 m, $l_r$ = 1.5 m ($L$ = 2.7 m), $C_f$ = 80 kN/rad, $C_r$ = 100 kN/rad. The lab's car with tyre slip is much smaller. Right now it has $m$ = {{live:dynM}} kg, $I_z$ = {{live:dynIz}} kg·m², $l_f$ = {{live:dynLf}} m and $l_r$ = {{live:dynLr}} m ($L$ = {{live:wheelbase}} m), $C_f$ = {{live:dynCf}} N/rad, $C_r$ = {{live:dynCr}} N/rad, μ = {{live:dynMu}} (Vehicle tab; the Grippy preset unless you changed it). The eigenvalues of the matrix above describe the vehicle's own yaw dynamics, before any controller acts. For the passenger car they are:

| $v_x$ [m/s] | eigenvalues [1/s] | $\omega_n$ [rad/s] | ζ | $r/\delta$ dynamic [1/s] | $r/\delta$ kinematic $v/L$ | ratio |
| --- | --- | --- | --- | --- | --- | --- |
| 5 | −22, −29 | 25 | 1.0 | 1.79 | 1.85 | 0.97 |
| 10 | −12.8 ± 3.6j | 13.3 | 0.96 | 3.25 | 3.70 | 0.88 |
| 20 | −6.4 ± 4.4j | 7.8 | 0.82 | 4.76 | 7.41 | 0.64 |
| 30 | −4.3 ± 4.6j | 6.2 | 0.68 | 4.94 | 11.1 | 0.44 |

At 5 m/s the yaw response is overdamped and fast, with a time constant under 50 ms, and the steady gain is within 3 % of the kinematic one. The kinematic model is fine there. At 30 m/s the vehicle's own yaw mode has a natural frequency of 6 rad/s with ζ = 0.68. It rings for a quarter of a second after a steering input, and the steady gain is less than half of what the geometry predicts. A tracker tuned on the kinematic model at that speed has a plant gain that is wrong by a factor of two. It also has a second-order mode near its crossover that its model does not contain.

**The lab's car.** Making the car smaller does not make the effect smaller. The understeer gradient (§5) says how much more the front tyres slip than the rear ones in a turn. It depends only on how hard each axle's tyres are worked for their load, $K_{us} = (1/g)(F_{zf}/C_f - F_{zr}/C_r)$. So the lab's characteristic speed, the speed at which the yaw response to steering peaks (§5), is set by its tyres alone. With realistic grippy tyres (about 9 and 16 N/rad per newton of load) it is 11.5 m/s. That is far above anything the lab drives, and the dynamics do not show. The *Slippery floor* preset uses tyres soft enough to bring it down to 2.6 m/s, so everything in this chapter happens at lab speeds:

| preset | $C_f$, $C_r$ [N/rad] | μ | $K_{us}$ [rad/(m/s²)] | $v_{ch}$ [m/s] | μ$g$ [m/s²] | eigenvalues at 1 / 2 / 4 m/s [1/s] | $r/\delta$ ÷ $v/L$ at 1 / 2 / 4 m/s |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Grippy | 500, 700 | 0.9 | 0.0046 | 11.5 | 8.83 | −92, −153 / −49, −74 / −30.7 ± 6.5j | 0.99 / 0.97 / 0.89 |
| Slippery floor | 40, 90 | 0.25 | 0.0875 | 2.62 | 2.45 | −9.2, −17.9 / −6.8 ± 3.3j (ζ 0.90) / −3.4 ± 4.3j (ζ 0.62) | 0.87 / 0.63 / 0.30 |

Both presets use $m$ = 10 kg, $I_z$ = 0.9 kg·m², $l_f$ = 0.27 m. The simulator integrates the model in 20 substeps of 2.5 ms per 50 ms tick, because the grippy yaw mode has time constants of a few milliseconds at low speed. The pose is still kept at the rear axle, which moves at $(v_x,\ v_y - l_r r)$ in body axes. Below 0.3 m/s the slip angles lose their meaning, since they divide by a speed close to zero, so there the simulator blends to the kinematic model. In reverse the slip angles change sign, so the tyres still oppose the sliding. [try: Slippery floor at 1.5 m/s | {"sim":true,"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"vmax":2,"vcruise":1.5,"alat":1.5},"plot":"cte","panes":[["yawr","yawk"],["beta"]],"layers":{"slip":true}}] [try: Same run, kinematic car | {"sim":true,"level":0,"set":{"veh":"car","vmax":2,"vcruise":1.5,"alat":1.5},"plot":"cte"}]

## 5. Understeer, the characteristic speed and stability

**Steady cornering.** Set the derivatives to zero and solve the state equation for the steady yaw rate per unit of steering. After some algebra the result can be written as

$$
\frac{r}{\delta}\Big|_{ss} = \frac{v_x}{L + K_{us}\,v_x^2}, \qquad K_{us} = \frac{m}{L}\left(\frac{l_r}{C_f} - \frac{l_f}{C_r}\right)
$$

$K_{us}$ is the understeer gradient, in rad per m/s². It is the extra steering angle, beyond the kinematic $L/R$, needed per unit of lateral acceleration to hold a turn. It is positive when the front tyres run at a larger slip angle than the rears for a given lateral acceleration. From the formula, that happens when $l_r/C_f > l_f/C_r$, which means a front-heavy weight distribution or softer front tyres. For the reference car $K_{us}$ = 0.00375 rad/(m/s²), or 0.21° per m/s². That car understeers, as nearly every production car is designed to.

**The characteristic speed.** For an understeering car the yaw-rate gain first rises with speed, then peaks and falls, because the $K_{us}v_x^2$ term in the denominator eventually dominates. The peak is at the characteristic speed

$$
v_{ch} = \sqrt{L / K_{us}} = \text{26.8 m/s for the reference car}
$$

There the two terms of the denominator are equal, so the gain is half the kinematic one. Below $v_{ch}$ the car turns more for each unit of steering as speed rises, as the kinematic model says. Above it, the car turns less. The ratio column of the table falls from 0.97 to 0.44 for this reason. A gain schedule built on the kinematic plant gain $v/L$, like the one in the gain-scheduling lesson, is off by that same ratio at speed.

With the current tyre settings, the lab's car has $K_{us}$ = {{live:Kus}} rad/(m/s²) ({{live:KusDeg}}° per m/s²), a characteristic speed of {{live:vch}} m/s and a grip limit of μ$g$ = {{live:mug}} m/s². At the operating speed of {{live:v0}} m/s its yaw gain is {{live:grPct}} % of $v/L$, its yaw mode has {{live:yawMode}}, and the grip runs out on turns tighter than {{live:Rgrip}} m. [try: Slippery floor in Analyze, 2 m/s | {"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"ctl":"pp","vmax":4,"vcruise":2}}]

**Stability.** The matrix in §4 has a negative trace at every speed. With two states and a negative trace, both eigenvalues have negative real parts whenever the determinant is positive, so the determinant decides stability. It works out to

$$
\det A = \frac{1}{I_z}\left(\frac{C_f C_r L^2}{m v_x^2} + l_r C_r - l_f C_f\right)
$$

The second term has the sign of $K_{us}$. For an understeering car it is positive, so the determinant is positive at every speed and the yaw dynamics are stable however fast the car goes. For an oversteering car, with $K_{us} < 0$, the determinant falls with speed and crosses zero at the critical speed

$$
v_{crit} = \sqrt{-L / K_{us}}
$$

Above that speed one eigenvalue is positive. A yaw disturbance then grows on its own, and the car spins unless the driver or the controller catches it. The lab's car oversteers if the slippery floor's stiffnesses are swapped ($C_f$ = 90, $C_r$ = 40 N/rad). Its critical speed is then $v_{crit}$ = 3.42 m/s, and at 4 m/s its yaw mode has a pole at +0.49 1/s. Analyze counts that pole in the Nyquist criterion (P = 1, one open-loop pole in the right half-plane). Pure pursuit with its default lookahead does not stabilize the car (phase margin −28°, and Z = 2 closed-loop poles in the right half-plane). Stanley has a higher crossover and does stabilize it, with 12.7° to spare. [try: Oversteering car, pure pursuit, 4 m/s | {"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":90,"Cr":40,"mu":0.25,"ctl":"pp","vmax":4,"vcruise":4}}] [try: Same, Stanley | {"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":90,"Cr":40,"mu":0.25,"ctl":"stanley","vmax":4,"vcruise":4}}] If you swap the reference car's weight distribution and stiffnesses ($l_f$ = 1.5, $l_r$ = 1.2, $C_f$ = 100, $C_r$ = 80 kN/rad), it oversteers with a gradient of the same magnitude. Its eigenvalues are −7.3 and −18 at 10 m/s and −0.33 and −9.9 at 25 m/s. At 30 m/s, past its critical speed of 26.8 m/s, one of them is +0.48. The saying "oversteer is for racing drivers" comes from this. Above its critical speed an oversteering car is unstable on its own, so the loop around it (the driver or the controller) has to supply the stability that an understeering car has built in.

**What this does to the loop of chapter 6.** The kinematic plant from steering to heading rate is a pure gain, $v/L$. The dynamic plant is a gain that depends on speed through $K_{us}$, times a second-order lag with the eigenvalues of §4. The open loop of chapter 6 §3 therefore picks up two more poles and a speed-dependent gain. Below about $v_{ch}/3$ the poles are fast and well damped, and the gain is within 10 % of the kinematic one, so everything in chapter 6 applies with the kinematic numbers. Near and above $v_{ch}$ the extra poles come within a decade of the lateral loop's crossover and cost phase there. The gain is also off by a factor approaching two. A controller designed on the kinematic model then responds more slowly than designed, or rings. Production lane-keeping controllers are scheduled on speed using the dynamic model for this reason. The lab can show the effect directly. With the car with tyre slip selected, Analyze puts the linear model of §4 between the steering and the heading. The lesson *Gain scheduling breaks above v_ch* shows pure pursuit's speed schedule losing its damping on the slippery floor. Its ζ is 0.71 at every speed on the kinematic car and 0.25 at 4 m/s with the tyres. The same lesson shows rear-wheel feedback's default gains left with 0.3° of phase margin at 2 m/s. [try: Rear-wheel feedback on the slippery floor, 2 m/s | {"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"ctl":"rwf","vmax":4,"vcruise":2},"test":"step","stepKind":"offset","stepAmp":0.05}]

## 6. The limits, and where the kinematic model stops

**Tyre saturation.** The linear tyre, $F = C\alpha$, holds for slip angles up to a few degrees. Beyond that the force rises more slowly and then falls. Its magnitude can never exceed what friction allows, $|F| \le \mu F_z$, the friction coefficient times the tyre's vertical load. The coefficient $\mu$ is around 0.9 on dry asphalt and 0.3 on wet or icy surfaces. Lateral and longitudinal forces share that budget (the friction circle), so a tyre that is braking hard has little lateral force left. For the planner this means that the total lateral acceleration a vehicle can sustain is about $\mu g$. That is 9 m/s² on a dry road and 3 m/s² on a wet one. It is less on a loaded vehicle, whose inside tyres unload in a turn.

**The lab's stand-in.** The kinematic car never slips, so left alone it would take any corner at any speed. The speed profile of chapter 5 §1 adds the missing physics as a cap on the lateral acceleration $v^2\kappa$:

$$
v \le \sqrt{a_{\text{lat}} / \kappa}, \qquad a_{\text{lat}} = \text{{{live:alat}} m/s² (Control tab)}
$$

In this lab that one number stands for tyres, friction and load transfer. The Experiments tab varies it when you ask how fast a route can be driven. At the planning radius of {{live:Rplan}} m and the operating speed of {{live:v0}} m/s the lab's car pulls {{live:ayPlan}} m/s², {{live:ayFrac}} % of the cap. The cap is sound as far as it goes, because a vehicle that keeps $v^2\kappa$ well below $\mu g$ stays in the linear tyre regime where the models above hold. With the kinematic car nothing checks the cap against the tyres. The car with tyre slip clips each axle's force at μ times its static load. On that car a cap above μ$g$ (now {{live:mug}} m/s²) asks for more than the floor can give. On the slippery floor at 2 m/s with the cap at 6 m/s², the front tyres saturate, and the car pushes wide of the first sharp turn and hits a pillar. The lesson *Running out of grip* is built on this run. [try: Cap above the grip | {"sim":true,"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"vmax":2.5,"vcruise":2,"alat":6},"plot":"cte","panes":[["ay","mug"]],"layers":{"slip":true,"trail":true}}]

**When the kinematic model is enough.** It takes three conditions. The lab's robots meet all of them, and a car on a motorway fails at least two:

- Lateral acceleration well below the friction limit, say under 0.3 g, so that the slip angles are a degree or two and the tyres are linear.
- Speed well below the characteristic speed, so that the steady yaw gain is within 10 % of $v/L$.
- The vehicle's yaw mode much faster than the loop. The §4 eigenvalues should be at least a decade above the tracker's crossover, so that the yaw dynamics look instantaneous to the controller.

At 0.8 m/s with a 0.6 m wheelbase, all three hold by a wide margin. So chapter 6 can analyze the lab's loops with a two-integrator plant and still match the simulator's step responses to within a percent. At 20 m/s with a 2.7 m wheelbase it is different. The first condition holds in a lane change and fails in an emergency swerve. The second is marginal. The third fails, because the yaw mode at 7.8 rad/s sits right where a lateral loop would want to cross over. In that regime the dynamic bicycle model takes over, along with controllers designed on it.

**What the lab leaves out.** The kinematic car has no body sideslip, so the centre of mass goes where the rear axle goes. It also has no yaw inertia, so steering changes the turn rate at once, slowed only by the steering-rate limit. The car with tyre slip adds both, through the model of §4 with linear tyres clipped at μ$F_z$. It still leaves out four things. There is no load transfer, so the static axle loads never change. There is no combined slip: braking and cornering do not share a friction circle, and speed follows the command as it does for the other vehicles. The tyre force does not fall beyond its peak, and there is no suspension. The planners, the trackers and the default MPC keep the kinematic model on purpose, so that the lessons can show what the mismatch costs. The car with tyre slip takes the turn rate for its odometry from the steering encoder, $v\tan\delta/L$. Slip therefore shows up as odometry error, unless the yaw-rate gyro is on (Vehicle tab).

## 7. What to carry into the next chapters

The chapters after this one use the kinematic models, and at the lab's speeds that is correct. The no-slip assumption is accurate there, the two-integrator plant of chapter 6 follows from it in two lines, and the trackers of chapter 5 need only the geometry. This chapter adds the limit of that use. A result that depends on $v/L$ as the plant gain holds only up to a lateral acceleration and a speed that the dynamic model names, $\mu g$ and $v_{ch}$. So does a delay margin computed with a kinematic crossover, and so does a gain schedule built on speed alone. Keep those two numbers in mind when you carry anything from this lab to a vehicle that can go fast. Beyond them a controller needs the tyres in its model. Chapter 7 §10 puts this chapter's dynamic bicycle model into the MPC's prediction, and the moose test (L7) shows the difference at 3.5 m/s.
