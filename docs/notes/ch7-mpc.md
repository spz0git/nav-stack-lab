id: ch7
num: 7
sys: ctl
summary: The derivations behind the MPC tracker: the receding-horizon idea, the prediction model with rate inputs and the optional actuator-lag model, the cost in path coordinates, constraints as box bounds and augmented-Lagrangian penalties, the condensed Gauss–Newton SQP that solves it in milliseconds, how the Analyze view turns it into gains, why it integrates, and the tyre model that replaces the kinematic prediction on the car with tyre slip.

# Model predictive control

The other trackers are laws: a formula from the errors to the command. MPC is a question asked every tick: of all the input sequences the vehicle could apply over the next two seconds, which one keeps it closest to the path at the right speed, within its limits and clear of what is around it? It applies the first step of the answer and asks again 50 ms later. This chapter derives the lab's MPC, in the order the Control lessons need it: the model it predicts with (§2), the cost (§3), the constraints (§4), the solver (§5), what the Analyze view sees when it linearizes the result (§6), why it integrates (§7), the speed loop it closes (§8), where it stops (§9), and the tyre model that moves one of those limits (§10). The blue numbers follow your settings: horizon $N_p$ = {{live:mpcNp}} steps of {{live:mpcDt}} s ({{live:mpcH}} s), $N_c$ = {{live:mpcNc}} free moves, {{live:mpcIt}} Gauss–Newton iterations per tick, lateral weight {{live:mpcQlat}}, actuator lag {{live:lagModel}}, tyre model {{live:mpcTyres}}.

## 1. Receding horizon

At time $t$ the controller has a state estimate $x_0$ and a reference trajectory along the path. It chooses inputs $u_0, \ldots, u_{N_c - 1}$ (held constant after $N_c$) to minimize a cost over the predicted states $x_1, \ldots, x_{N_p}$ subject to constraints, applies $u_0$ for one tick, and repeats from the new estimate. Three things follow from the structure alone. Feedback comes from re-solving, not from a gain: a disturbance changes $x_0$ and the next solution accounts for it. Constraints are first-class: a steering lock or a pedestrian is a condition on the solution, not a saturation applied afterwards. And the horizon is the controller's foresight: it brakes for a curve $N_p \Delta t$ seconds before reaching it, which no law that looks only at the current error can do.

## 2. The prediction model

**States and inputs.** The state is $x = [x, y, \theta, v, s]$ where $s$ is the steering angle δ for the car or the turn rate ω for the diff-drive, and the inputs are rates, $u = [a, \dot s]$: acceleration and steering rate (or turn-rate rate). Using rates as inputs does two things. The actuator limits that are really rate limits (the car's 1.5 rad/s of steering, the acceleration bound) become simple bounds on $u$, which the solver can enforce exactly. And the command is built on the previous command, $s_{\text{next}} = s + \dot s\,\Delta t$, which makes the controller integrate: §7.

**One step.** The model integrates the kinematic bicycle (chapter 1 §3) with the heading taken at the midpoint of the step:

$$
\omega = \begin{cases} v\tan s / L & \text{car} \\ s & \text{diff-drive} \end{cases},\qquad
\theta_m = \theta + \tfrac12\omega\Delta t,\qquad
\begin{bmatrix} x \\ y \\ \theta \\ v \\ s \end{bmatrix}_{k+1} =
\begin{bmatrix} x + v\cos\theta_m\,\Delta t \\ y + v\sin\theta_m\,\Delta t \\ \theta + \omega\Delta t \\ v + a\Delta t \\ \operatorname{sat}(s + \dot s\,\Delta t) \end{bmatrix}
$$

The steering state saturates inside the model, at ±δ<sub>max</sub> or ±ω<sub>max</sub>, so the prediction never assumes a lock the vehicle does not have. The step is $\Delta t$ = {{live:mpcDt}} s, twice the control tick, so the horizon of {{live:mpcNp}} steps reaches {{live:mpcH}} s ahead.

**The lag model.** When "Include actuator lag" is on and the lag τ is nonzero, the state grows by two commanded values, $v_c$ and $s_c$, and the actual $v$ and $s$ follow them through a first-order response, $s_{k+1} = s + (s_c - s)(1 - e^{-\Delta t/\tau})$, with the inputs now driving the commanded values. The model then knows that a steering command takes effect over τ, which the actuator-lag lesson shows is worth 20° of phase margin: without it the controller plans as if steering were instantaneous, measures a lagging actuator, and reacts to its own unexecuted commands.

## 3. The cost

The reference is a trajectory, not a path: the point the robot should be at in $k\Delta t$ seconds, found by advancing along the path at the speed profile of chapter 5 §1 (or, when the speed planner is active, along its space-time profile, so that the reference itself yields to people instead of dragging the robot into them). Each predicted state is compared with its reference point in the path frame, longitudinal, lateral, heading and speed, with weights, plus a terminal weight on the last step; each input is penalized, and so is each change of input between steps:

$$
J = \sum_{k=1}^{N_p} w_k\Big(Q_{\text{lon}}\,e_{\text{lon},k}^2 + Q_{\text{lat}}\,e_{\text{lat},k}^2 + Q_\theta\,\theta_{e,k}^2 + Q_v\,(v_k - v_{r,k})^2\Big) + \sum_{k=0}^{N_p - 1}\Big(R_a a_k^2 + R_s \dot s_k^2 + R_d\,\|u_k - u_{k-1}\|^2\Big)
$$

with $w_k = 1$ except $w_{N_p} = Q_f$. The ratio of the $Q$ to the $R$ terms is the controller's aggressiveness: raise $Q_{\text{lat}}$ ({{live:mpcQlat}} now) and it corrects lateral error harder, which in the loop of chapter 6 means a higher crossover and less margin, exactly as a higher $K_e$ would. The $R_d$ term is what keeps the steering smooth from one solve to the next; the heading is unwrapped along the horizon so that a reference crossing ±π does not look like a spin.

## 4. The constraints

Two kinds, handled differently because they are different in nature.

**Input bounds** are box constraints on the decision variables: $|a| \le a_{\max}$, $|\dot s| \le \dot s_{\max}$. The QP in §5 handles bounds on its own variables exactly, by projection, so these never need a penalty.

**State constraints** depend on the predicted states, which depend nonlinearly on the inputs: speed within $[0, v_{\max}]$ in the leg's direction, steering within the lock, and clearance. Clearance is a distance from each footprint circle (three along the car, one for the diff-drive) to the nearest lidar point and to each predicted person, grown by the person's predicted radius and a margin of {{live:mpcMarg}} m, over the prediction up to step $N_p$ and, for the last step, out to the speed planner's window, because a robot that stops at the end of its horizon must still be clear while it waits. Each such condition $c(x_k) \le 0$ enters the cost as an augmented-Lagrangian term:

$$
\frac{\rho}{2}\,\max\!\Big(0,\ c(x_k) + \frac{\lambda_k}{\rho}\Big)^2, \qquad \lambda_k \leftarrow \max(0,\ \lambda_k + \rho\,c(x_k))\ \text{after each solve}
$$

The penalty weight ρ = {{live:mpcRho}} alone would need to be enormous to hold a constraint exactly; the multiplier λ, updated from one tick to the next, remembers how hard the constraint pushed last time and lets a moderate ρ enforce it to a small violation. The violation reported in the MPC stats is the largest $c$ over the horizon. For the agent constraints the controller also computes what pure braking would achieve from the current state, and relaxes the constraint by that amount, so that a person who is unavoidable at any input does not make the problem infeasible; the robot then brakes rather than freezes.

## 5. Solving it in 15 milliseconds

**Condensing.** The decision vector is the $2N_c$ input rates. The states are not variables; they are computed by rolling the model forward from $x_0$ (single shooting). The cost is a sum of squared residuals $r_i(U)$, state terms and input terms alike, which makes it a nonlinear least-squares problem and gives the Gauss–Newton method: linearize the residuals, $r(U + \Delta U) \approx r + J\,\Delta U$, and solve the resulting quadratic for the step,

$$
\min_{\Delta U}\ \tfrac12\,\Delta U^{\mathsf T}(J^{\mathsf T}J)\,\Delta U + (J^{\mathsf T}r)^{\mathsf T}\Delta U \quad \text{s.t.}\quad u_{\min} \le U + \Delta U \le u_{\max}
$$

The Jacobian of a state residual with respect to the inputs needs $\partial x_k / \partial U$, which is built by chaining the model's Jacobians along the horizon: $S_{k+1} = A_k S_k + B_k E_k$ with $A_k = \partial f/\partial x$, $B_k = \partial f/\partial u$ at the current rollout and $E_k$ selecting the input that acts at step $k$. The model Jacobians are computed by central differences. Not forward differences: at full lock the steering state is clipped, a forward step from +δ<sub>max</sub> returns zero sensitivity, and a solver that sees zero sensitivity to steering at full lock cannot unwind it.

**The box QP.** The quadratic subproblem with bounds is solved by projected Newton (Bertsekas 1982): identify the variables pinned at a bound by the gradient, take a Newton step in the free ones, project back into the box, backtrack on the cost. Up to 40 such iterations; in practice a handful. Then a line search on the true nonlinear cost accepts the step or halves it, the multipliers are updated, and the next Gauss–Newton iteration relinearizes about the new rollout. That relinearization is what makes it NMPC; the LTV option linearizes once about the reference trajectory and predicts with that linear model, which is cheaper and adequate near the path.

**Budget and warm start.** {{live:mpcIt}} iterations per tick, or fewer if 15 ms have passed. Each solve starts from the previous tick's solution shifted forward by one control tick, with the multipliers shifted the same way, so that between ticks only the new information needs solving for. The MPC stats under the Control tab report the time, iterations, cost and violation of every solve.

[try: MPC on L1 | {"level":0,"set":{"ctl":"mpc"}}] [try: MPC, τ = 0.15 s, lag not modeled | {"level":0,"set":{"ctl":"mpc","lag":0.15,"mpcLag":false}}] [try: Lag modeled | {"level":0,"set":{"ctl":"mpc","lag":0.15,"mpcLag":true}}]

## 6. What the Analyze view sees

Near the path the MPC's first command is a smooth function of the state, so it has a linearization, and the Analyze view reads it the same way it reads the other trackers: settle the loop at the operating point, nudge one quantity by a small amount, resolve the MPC to convergence (25 iterations, for a clean derivative), and read the change in the commanded rate. Nudging $e$ and $\theta_e$ gives $K_e$ and $K_\theta$; nudging the actuator state gives its feedback on the steering it measures; nudging the commanded state (with the lag model on) gives $K_c$, the feedback on its own last command; and nudging the previous input gives $K_u$, how much of the last rate it carries over. Those gains, with the rate integrator and the one-tick delay, are the open loop $L(s)$ that chapter 6 analyzes, and the chips, margins and poles follow. This is why an "optimal" controller still has a phase margin and a delay margin: the optimization chooses the gains, the clock in the loop is still there.

The actuator-lag lesson is the clearest reading of it. With τ = 0.15 s and the lag not modeled, the linearized MPC has a phase margin of about 30° and $M_s$ above 2, worse than pure pursuit's 49° on the same plant, because its gains were computed for a plant that responds instantly. With the lag modeled the gains change, $K_c$ appears, and the margin returns to about 53°. The cross-track error in L5 barely moves between the two; what moves is how much extra delay or model error the loop can take before it rings, which is the quantity a safety case cares about.

## 7. Why it integrates

The input is a rate and the command is accumulated, $s_{\text{cmd}} \leftarrow s_{\text{cmd}} + \dot s\,T$, so a constant disturbance at the actuator is integrated away: if a bias keeps the robot off the path, the cost keeps asking for a nonzero rate, and the accumulated command keeps growing until the error is gone. In chapter 6 terms there is a $1/s$ in the loop ahead of the plant, so the steady-state error to an actuator bias is zero, and the integral-action lesson measures it: the diff-drive MPC under a 0.1 rad/s turn-rate bias settles with a residual of a few tenths of a percent of the bias response, where rear-wheel feedback on the car leaves 28 %. There is a condition, though. The integrator acts on what the controller measures. The diff-drive measures its turn rate, so the bias shows up in the measured ω and is removed. The car's steering misalignment is in the linkage, downstream of the steering encoder, so the MPC reads a steering angle that is correct and a vehicle that turns anyway; the error it can remove is only what shows in the pose, through the slower path-tracking terms, and a small residual remains.

[try: Diff-drive MPC, 0.1 rad/s bias | {"level":0,"set":{"ctl":"mpc"},"stepKind":"bias","test":"step"}]

## 8. The speed loop

The other trackers command speed from the profile open-loop; the MPC has $v$ as a state and $(v - v_r)^2$ in its cost, so it closes a speed loop through the acceleration input. The Analyze view's Speed loop selector reads its gains the same way as the lateral ones: $K_v$ on the speed error, $K_{vc}$ on the commanded speed (with the lag model), $K_u$ on the previous acceleration, and reports a crossover, a phase margin and a delay margin for the speed loop. In the speed-loop lesson, pure pursuit with τ = 0.3 s shows the open chain's bandwidth of 3.4 rad/s and a step that follows the first-order response; the MPC with the lag modeled shows a loop with 71° of phase margin at 3.1 rad/s and a step that reaches the reference in the same time with 1 % overshoot. The acceleration bound is where the two differ: a large step saturates the MPC's $a_{\max}$ and the response is a ramp, which the linear analysis does not predict, and the lesson shows.

## 9. Where it stops

Three limits are worth knowing. The horizon: {{live:mpcH}} s of prediction is enough for a 0.8 m/s robot to brake for what it sees, and nothing beyond it exists for the controller, which is why the speed planner's longer window supplies the reference. Local minima: a Gauss–Newton step from a warm start finds the nearby optimum, and a person directly ahead can leave the solver choosing between left and right by the accident of the last solution. And the model: the MPC is only as good as §2, and every lesson that adds something the model lacks, a lag, a bias, latency, tyres that slip, shows the cost in margin before it shows in tracking error. §10 puts the tyres into the model.

## 10. The tyre model in the prediction

On the car with tyre slip, the kinematic prediction of §2 is wrong in a way that grows with speed: it says the heading turns at $v\tan\delta/L$ the moment the wheels point, and the car turns at $v/(L + K_{us}v^2)$ per unit of steering, through a yaw mode of its own (chapter 1 §4–5). On the slippery floor at 3.5 m/s that is 36 % of the kinematic rate, and it builds up through poles at −3.9 ± 4.2j 1/s, a time constant of about a quarter of a second. Control → Tyre model in the prediction (shown for the car with tyre slip; now {{live:mpcTyres}}) replaces the model with the one the simulator runs.

**States.** Two are added after the others: the lateral velocity $v_y$ and the yaw rate $r$ at the centre of mass, so $x = [x, y, \theta, v, \delta, v_y, r]$, with the lag states in between when the lag model is on. The inputs are still $u = [a, \dot\delta]$, so the bounds, the cost and the solver of §3–5 are unchanged; the cost still compares only the pose and the speed with the reference, and $v_y$ and $r$ matter through what they do to the pose.

**One step.** Speed and steering are held over the step as in §2. Within it the lateral dynamics of chapter 1 §4 run with the tyre forces clipped at their friction limits,

$$
\dot v_y = \frac{F_f\cos\delta + F_r}{m} - v\,r,\qquad
\dot r = \frac{l_f F_f\cos\delta - l_r F_r}{I_z},\qquad
F_i = \operatorname{clamp}\big(C_i\,\alpha_i,\ \pm\mu F_{z,i}\big)
$$

with the slip angles $\alpha_f = \tan\delta - (v_y + l_f r)/v$ and $\alpha_r = -(v_y - l_r r)/v$ of the simulator. The yaw mode is fast with grippy tyres at low speed (time constants of a few milliseconds), so each 0.1 s prediction step takes five substeps of one linearly implicit Euler stage, $(I - hJ)\,\Delta = h\,f$ with the 2 × 2 Jacobian $J$ by differences: L-stable, so stiff tyres converge to the kinematic car instead of blowing up. After each substep the rear axle moves with the new velocities, forward at $v$ and sideways at $v_y - l_r r$, and the heading at $r$. Below 0.3 m/s the state blends to the kinematic one, as in the simulator.

**What the optimizer sees.** The Jacobians of §5, by central differences, now carry the tyres: the sensitivity of the heading to a steering rate is small and delayed, and once a tyre is at its limit, more steering moves nothing in the prediction. With the same weights as before, the solution starts a swerve earlier and steers further. In the moose test (L7) at 3.5 m/s the kinematic MPC starts at 1.35 s, steers up to 15° and hits the first box; with the tyre model the MPC starts at 0.8 s, steers up to 21°, and passes both boxes 0.40 m off its path at worst. With stiff tyres ($C$ = 10⁶ N/rad) the two models drive the same line to within a centimetre, which is the check that nothing else changed. A solve takes about 0.2 ms longer.

**What the Analyze view sees.** Nudging $v_y$ and $r$ at the operating point gives two more gains, $K_{v_y}$ and $K_r$, and the loop of §6 gets them as two more feedback paths, through the linear tyre model the Analyze view uses for the car with tyre slip. On the moose test at 3.5 m/s the kinematic MPC's loop has a phase margin of 69° but dominant poles with ζ 0.22 (50 % overshoot, 11.5 s to settle); with the tyre model, ζ 0.70 and 4.1 % overshoot, close to the kinematic MPC on the kinematic car (ζ 0.73, 3.2 %). The simulator's step test agrees with both to a tenth of a percent.

[try: Moose test, kinematic MPC | {"sim":true,"level":6,"panes":[["yawr","yawk"],["cte"]],"layers":{"slip":true}}] [try: Moose test, tyre model | {"sim":true,"level":6,"set":{"mpcDyn":true},"panes":[["yawr","yawk"],["cte"]],"layers":{"slip":true}}] [try: Analyze, tyre model | {"level":6,"set":{"mpcDyn":true},"test":"step","stepKind":"offset","stepAmp":0.05}]

**What it does not do.** It reads $v_y$ and $r$ from the simulator, where a real car would have a gyro for $r$ and an estimate of $v_y$. Its tyres are those of the simulator, linear up to a hard limit, so it is right about the car by construction; a real tyre model is never that good. And it does not brake for a swerve it cannot make: with μ 0.1 it hits the first box at full speed like the kinematic MPC. Its cost holds the speed to the reference, and with the tyres saturated, slowing down pays off only late in the horizon. A reference speed that respects the grip, $v \le \sqrt{\mu g/\kappa}$, is still the speed profile's job.
