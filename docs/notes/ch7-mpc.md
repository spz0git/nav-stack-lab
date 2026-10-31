id: ch7
num: 7
sys: ctl
summary: The derivations behind the MPC tracker: the receding-horizon idea, the prediction model with rate inputs and the optional actuator-lag model, the cost in path coordinates, constraints as box bounds and augmented-Lagrangian penalties, the condensed Gauss–Newton SQP that solves it in milliseconds, how the Analyze view turns it into gains, why it integrates, and the tyre model that replaces the kinematic prediction on the car with tyre slip.

# Model predictive control

The other trackers are laws, each a formula that maps the errors to a command. MPC (model predictive control) solves an optimization problem on every tick instead. It looks at the input sequences the vehicle could apply over the next two seconds, and picks the one that keeps the vehicle closest to the path at the right speed, within its limits and clear of what is around it. It applies the first step of that sequence, and 50 ms later it solves the problem again. This chapter derives the lab's MPC in the order the Control lessons need it. §2 is the model it predicts with, §3 the cost, §4 the constraints and §5 the solver. §6 shows what the Analyze view sees when it linearizes the result, §7 why the controller integrates, and §8 the speed loop it closes. §9 covers where it stops working, and §10 the tyre model that moves one of those limits. The blue numbers follow your settings. The horizon is $N_p$ = {{live:mpcNp}} steps of {{live:mpcDt}} s ({{live:mpcH}} s), with $N_c$ = {{live:mpcNc}} free moves and {{live:mpcIt}} Gauss–Newton iterations per tick. The lateral weight is {{live:mpcQlat}}, the actuator lag is set to {{live:lagModel}}, and the tyre model is {{live:mpcTyres}}.

## 1. Receding horizon

At time $t$ the controller has a state estimate $x_0$ and a reference trajectory along the path. It chooses the inputs $u_0, \ldots, u_{N_c - 1}$, which are held constant after $N_c$. It chooses them to minimize a cost over the predicted states $x_1, \ldots, x_{N_p}$, subject to constraints. It applies $u_0$ for one tick and repeats from the new estimate. Three properties follow from this structure alone. The feedback comes from solving again on each tick, and there is no gain in the law. A disturbance changes $x_0$, and the next solution takes it into account. The constraints are part of the problem. A steering lock or a pedestrian is a condition on the solution, and is not handled by clipping the command afterwards. The horizon gives the controller foresight. It brakes for a curve $N_p \Delta t$ seconds before reaching it, and a law that looks only at the current error cannot do that.

## 2. The prediction model

**States and inputs.** The state is $x = [x, y, \theta, v, s]$, where $s$ is the steering angle δ for the car or the turn rate ω for the diff-drive. The inputs are rates, $u = [a, \dot s]$. They are the acceleration and the steering rate (for the diff-drive, the rate of change of the turn rate). Using rates as inputs has two effects. The actuator limits that are really rate limits (the car's 1.5 rad/s of steering, the acceleration bound) become simple bounds on $u$, and the solver can enforce those exactly. The command is also built on the previous command, $s_{\text{next}} = s + \dot s\,\Delta t$, and that makes the controller integrate (§7).

**One step.** The model integrates the kinematic bicycle (chapter 1 §3) with the heading taken at the midpoint of the step:

$$
\omega = \begin{cases} v\tan s / L & \text{car} \\ s & \text{diff-drive} \end{cases},\qquad
\theta_m = \theta + \tfrac12\omega\Delta t,\qquad
\begin{bmatrix} x \\ y \\ \theta \\ v \\ s \end{bmatrix}_{k+1} =
\begin{bmatrix} x + v\cos\theta_m\,\Delta t \\ y + v\sin\theta_m\,\Delta t \\ \theta + \omega\Delta t \\ v + a\Delta t \\ \operatorname{sat}(s + \dot s\,\Delta t) \end{bmatrix}
$$

The steering state saturates inside the model, at ±δ<sub>max</sub> or ±ω<sub>max</sub>, so the prediction never assumes a lock the vehicle does not have. The step is $\Delta t$ = {{live:mpcDt}} s, twice the control tick, so the horizon of {{live:mpcNp}} steps reaches {{live:mpcH}} s ahead.

**The lag model.** When "Include actuator lag" is on and the lag τ is nonzero, two commanded values, $v_c$ and $s_c$, are added to the state. The inputs now drive the commanded values, and the actual $v$ and $s$ follow them through a first-order response, $s_{k+1} = s + (s_c - s)(1 - e^{-\Delta t/\tau})$. The model then knows that a steering command takes effect over a time τ. The actuator-lag lesson shows that this is worth 20° of phase margin. Without the lag model the controller plans as if steering were instantaneous. It then measures an actuator that lags behind, and reacts to its own commands before they have taken effect.

## 3. The cost

The reference is a trajectory, so it gives a time as well as a place. For each step of the horizon it is the point where the robot should be in $k\Delta t$ seconds. That point is found by advancing along the path at the speed profile of chapter 5 §1. When the speed planner is active, it advances along the planner's space-time profile instead, so that the reference itself yields to people and does not drag the robot into them. Each predicted state is compared with its reference point in the path frame. The longitudinal, lateral, heading and speed errors each have a weight, and the last step gets an extra terminal weight. Each input is penalized, and so is each change of input between steps:

$$
J = \sum_{k=1}^{N_p} w_k\Big(Q_{\text{lon}}\,e_{\text{lon},k}^2 + Q_{\text{lat}}\,e_{\text{lat},k}^2 + Q_\theta\,\theta_{e,k}^2 + Q_v\,(v_k - v_{r,k})^2\Big) + \sum_{k=0}^{N_p - 1}\Big(R_a a_k^2 + R_s \dot s_k^2 + R_d\,\|u_k - u_{k-1}\|^2\Big)
$$

Here $w_k = 1$, except $w_{N_p} = Q_f$. The ratio of the $Q$ terms to the $R$ terms sets how aggressive the controller is. If you raise $Q_{\text{lat}}$ ({{live:mpcQlat}} now), it corrects lateral error harder. In the loop of chapter 6 that means a higher crossover and less margin, as a higher $K_e$ would give. The $R_d$ term keeps the steering smooth from one solve to the next. The heading is unwrapped along the horizon, so that a reference crossing ±π does not look like a spin.

## 4. The constraints

The constraints come in two kinds, and the controller handles them in different ways.

**Input bounds** are box constraints on the decision variables, $|a| \le a_{\max}$ and $|\dot s| \le \dot s_{\max}$. The QP (quadratic program) in §5 enforces bounds on its own variables exactly, by projection, so these never need a penalty.

**State constraints** depend on the predicted states, and those depend nonlinearly on the inputs. They keep the speed within $[0, v_{\max}]$ in the leg's direction, the steering within the lock, and a clearance. The clearance is the distance from each footprint circle (three along the car, one for the diff-drive) to the nearest lidar point and to each predicted person. Each person is grown by their predicted radius and a margin of {{live:mpcMarg}} m. The clearance is checked over the prediction up to step $N_p$. For the last step it is also checked further ahead, out to the speed planner's window, because a robot that stops at the end of its horizon must still be clear while it waits. Each such condition $c(x_k) \le 0$ enters the cost as an augmented-Lagrangian term:

$$
\frac{\rho}{2}\,\max\!\Big(0,\ c(x_k) + \frac{\lambda_k}{\rho}\Big)^2, \qquad \lambda_k \leftarrow \max(0,\ \lambda_k + \rho\,c(x_k))\ \text{after each solve}
$$

On its own, the penalty weight ρ = {{live:mpcRho}} would have to be enormous to hold a constraint exactly. The multiplier λ is updated from one tick to the next. It remembers how hard the constraint pushed last time, and with it a moderate ρ keeps the violation small. The violation reported in the MPC stats is the largest $c$ over the horizon. For the constraints on people, the controller also computes what pure braking would achieve from the current state. It relaxes the constraint by that amount, so that a person who cannot be avoided with any input does not make the problem infeasible. The robot then brakes instead of freezing.

## 5. Solving it in 15 milliseconds

**Condensing.** The decision vector holds the $2N_c$ input rates. The states are not decision variables. They are computed by rolling the model forward from $x_0$, which is called single shooting. The cost is a sum of squared residuals $r_i(U)$, for the state terms and the input terms alike. So it is a nonlinear least-squares problem, and the Gauss–Newton method applies. It linearizes the residuals, $r(U + \Delta U) \approx r + J\,\Delta U$, and solves the resulting quadratic for the step:

$$
\min_{\Delta U}\ \tfrac12\,\Delta U^{\mathsf T}(J^{\mathsf T}J)\,\Delta U + (J^{\mathsf T}r)^{\mathsf T}\Delta U \quad \text{s.t.}\quad u_{\min} \le U + \Delta U \le u_{\max}
$$

The Jacobian of a state residual with respect to the inputs needs the sensitivity $\partial x_k / \partial U$. Writing S for that sensitivity, it is built by chaining the model's Jacobians along the horizon, $S_{k+1} = A_k S_k + B_k E_k$. Here $A_k = \partial f/\partial x$ and $B_k = \partial f/\partial u$ are taken at the current rollout, and $E_k$ selects the input that acts at step $k$. The model Jacobians are computed by central differences, not forward differences. At full lock the steering state is clipped, so a forward step from +δ<sub>max</sub> returns zero sensitivity. A solver that sees zero sensitivity to steering at full lock cannot unwind it.

**The box QP.** The quadratic subproblem with bounds is solved by projected Newton (Bertsekas 1982). Each iteration finds the variables that sit on a bound with the gradient pushing them outwards, and keeps them there. It takes a Newton step in the remaining free variables, projects the result back into the box, and backtracks on the cost. The solver allows up to 40 such iterations, and in practice needs a handful. Then a line search on the true nonlinear cost accepts the step or halves it. The multipliers are updated, and the next Gauss–Newton iteration linearizes again about the new rollout. This relinearization is what makes it NMPC (nonlinear MPC). The LTV option (linear time-varying) linearizes once about the reference trajectory and predicts with that linear model. It is cheaper, and good enough near the path.

**Budget and warm start.** The solver runs {{live:mpcIt}} iterations per tick, or fewer if the real-time budget runs out first. The budget is 15 ms by default (Control → Real-time budget, 0 for none). With a budget, the result of a solve depends on the computer's speed. With 0, every iteration runs and the result is the same on every computer. Each solve starts from the previous tick's solution, shifted forward by one control tick, with the multipliers shifted the same way. So each solve only has to deal with what is new since the last tick. The MPC stats under the Control tab report the time, iterations, cost and violation of every solve.

[try: MPC on L1 | {"level":0,"set":{"ctl":"mpc"}}] [try: MPC, τ = 0.15 s, lag not modeled | {"level":0,"set":{"ctl":"mpc","lag":0.15,"mpcLag":false}}] [try: Lag modeled | {"level":0,"set":{"ctl":"mpc","lag":0.15,"mpcLag":true}}]

## 6. What the Analyze view sees

Near the path the MPC's first command is a smooth function of the state, so it has a linearization. The Analyze view reads it the same way it reads the other trackers. It settles the loop at the operating point and nudges one quantity by a small amount. It then solves the MPC again to convergence (25 iterations, for a clean derivative) and reads the change in the commanded rate. Nudging $e$ and $\theta_e$ gives $K_e$ and $K_\theta$. Nudging the actuator state gives the feedback on the steering the controller measures. With the lag model on, nudging the commanded state gives $K_c$, the feedback on the controller's own last command. Nudging the previous input gives $K_u$, how much of the last rate it carries over. Those gains, together with the rate integrator and the one-tick delay, make up the open loop $L(s)$ that chapter 6 analyzes, and the chips, margins and poles follow from it. So an "optimal" controller still has a phase margin and a delay margin. The optimization chooses the gains, but the clock in the loop is still there.

The actuator-lag lesson shows this most clearly. With τ = 0.15 s and the lag not modeled, the linearized MPC has a phase margin of about 30° and $M_s$ (the peak of the sensitivity function) above 2. That is worse than pure pursuit's 49° on the same plant, because the MPC's gains were computed for a plant that responds instantly. With the lag modeled the gains change, $K_c$ appears, and the margin returns to about 53°. The cross-track error in L5 does not improve with the lag modeled. At the default seed it is 8.1 cm RMS with the lag modeled and 5.8 cm without it. What changes is how much extra delay or model error the loop can take before it rings, and that is the quantity a safety case cares about.

## 7. Why it integrates

The input is a rate and the command is accumulated, $s_{\text{cmd}} \leftarrow s_{\text{cmd}} + \dot s\,T$, so a constant disturbance at the actuator is integrated away. If a bias keeps the robot off the path, the cost keeps asking for a nonzero rate, and the accumulated command keeps growing until the error is gone. In the terms of chapter 6, there is a $1/s$ in the loop ahead of the plant, so the steady-state error to an actuator bias is zero. The integral-action lesson measures this. Under a 0.1 rad/s turn-rate bias, the diff-drive MPC settles with a residual of a few tenths of a percent of the bias response. Rear-wheel feedback on the car leaves 28 %. This works only for a bias that the controller can see, because the integrator acts on what the controller measures. The diff-drive measures its turn rate, so the bias shows up in the measured ω and is removed. The car's steering misalignment is in the linkage, after the steering encoder. The MPC therefore reads a steering angle that is correct, and a vehicle that turns anyway. It can still act on the pose error through its path-tracking terms, but those settle with a standing error. Under a 2° misalignment the car's MPC settles at 71 % of the bias response, more than rear-wheel feedback's 28 %.

[try: Diff-drive MPC, 0.1 rad/s bias | {"level":0,"set":{"ctl":"mpc"},"stepKind":"bias","test":"step"}]

## 8. The speed loop

The other trackers command speed from the profile, open-loop. The MPC has $v$ as a state and $(v - v_r)^2$ in its cost, so it closes a speed loop through the acceleration input. The Analyze view's Speed loop selector reads its gains the same way as the lateral ones. They are $K_v$ on the speed error, $K_{vc}$ on the commanded speed (with the lag model) and $K_u$ on the previous acceleration. The view reports a crossover, a phase margin and a delay margin for the speed loop. In the speed-loop lesson, pure pursuit with τ = 0.3 s shows the open chain's bandwidth of 3.4 rad/s, and its step follows the first-order response. The MPC with the lag modeled shows a loop with 71° of phase margin at 3.1 rad/s. Its step reaches the reference in the same time, with 1 % overshoot. The two differ at the acceleration bound. A large step saturates the MPC's $a_{\max}$, and the response becomes a ramp. The linear analysis does not predict this, and the lesson shows it.

## 9. Where it stops

Three limits are worth knowing. The first is the horizon. A prediction of {{live:mpcH}} s is enough for a 0.8 m/s robot to brake for what it sees, but nothing beyond the horizon exists for the controller. For this reason the speed planner, whose window is longer, supplies the reference. The second is local minima. A Gauss–Newton step from a warm start finds the nearby optimum. With a person directly ahead, whether the solver goes left or right can depend on the accident of the last solution. The third is the model, since the MPC is only as good as its model (§2). Some lessons add something the model lacks: a lag, a bias, latency, or tyres that slip. Each of them shows the cost in margin before it shows in tracking error. §10 puts the tyres into the model.

## 10. The tyre model in the prediction

On the car with tyre slip, the kinematic prediction of §2 is wrong, and the error grows with speed. The prediction says the heading turns at $v\tan\delta/L$ as soon as the wheels point. The car actually turns at $v/(L + K_{us}v^2)$ per unit of steering, and it gets there through a yaw mode of its own (chapter 1 §4–5). On the slippery floor at 3.5 m/s that is 36 % of the kinematic rate. The turn builds up through poles at −3.9 ± 4.2j 1/s, with a time constant of about a quarter of a second. Control → Tyre model in the prediction (shown for the car with tyre slip; now {{live:mpcTyres}}) replaces the model with the one the simulator runs.

**States.** Two states are added after the others, the lateral velocity $v_y$ and the yaw rate $r$ at the centre of mass. So $x = [x, y, \theta, v, \delta, v_y, r]$, with the lag states in between when the lag model is on. The inputs are still $u = [a, \dot\delta]$, so the bounds, the cost and the solver of §3–5 are unchanged. The cost still compares only the pose and the speed with the reference. The states $v_y$ and $r$ matter only through what they do to the pose.

**One step.** Speed and steering are held over the step as in §2. Within the step the lateral dynamics of chapter 1 §4 run with the tyre forces clipped at their friction limits,

$$
\dot v_y = \frac{F_f\cos\delta + F_r}{m} - v\,r,\qquad
\dot r = \frac{l_f F_f\cos\delta - l_r F_r}{I_z},\qquad
F_i = \operatorname{clamp}\big(C_i\,\alpha_i,\ \pm\mu F_{z,i}\big)
$$

The slip angles are the simulator's, $\alpha_f = \tan\delta - (v_y + l_f r)/v$ and $\alpha_r = -(v_y - l_r r)/v$. With grippy tyres at low speed the yaw mode is fast, with time constants of a few milliseconds. So each 0.1 s prediction step is split into five substeps. Each substep is one stage of linearly implicit Euler, $(I - hJ)\,\Delta = h\,f$, where h is the substep length, f the right-hand side of the lateral dynamics above, and the 2 × 2 Jacobian $J$ is computed by differences. This method is L-stable: it damps very fast modes instead of amplifying them, so stiff tyres converge to the kinematic car instead of blowing up. After each substep the rear axle moves with the new velocities, forward at $v$ and sideways at $v_y - l_r r$, and the heading turns at rate $r$. Below 0.3 m/s the state blends to the kinematic one, as in the simulator.

**What the optimizer sees.** The Jacobians of §5, still taken by central differences, now include the tyres. The sensitivity of the heading to a steering rate is small and delayed. Once a tyre is at its limit, more steering changes nothing in the prediction. With the same weights as before, the solution starts a swerve earlier and steers further. In the moose test (L7) at 3.5 m/s the kinematic MPC starts its swerve at 1.35 s, steers up to 15° and hits the first box. With the tyre model the MPC starts at 0.85 s, steers up to 21°, and passes both boxes, at worst 0.40 m off its path. With stiff tyres ($C$ = 10⁶ N/rad) the two models drive the same line to within a centimetre. This checks that nothing else changed. A solve takes about 0.2 ms longer.

**What the Analyze view sees.** Nudging $v_y$ and $r$ at the operating point gives two more gains, $K_{v_y}$ and $K_r$. They enter the loop of §6 as two more feedback paths, through the linear tyre model that the Analyze view uses for the car with tyre slip. On the moose test at 3.5 m/s the kinematic MPC's loop has a phase margin of 69°, but its dominant poles have ζ 0.22 (50 % overshoot, 11.5 s to settle). With the tyre model they have ζ 0.70 and 4.1 % overshoot. That is close to the kinematic MPC on the kinematic car (ζ 0.73, 3.2 %). The simulator's step test agrees with both to a tenth of a percent.

[try: Moose test, kinematic MPC | {"sim":true,"level":6,"panes":[["yawr","yawk"],["cte"]],"layers":{"slip":true}}] [try: Moose test, tyre model | {"sim":true,"level":6,"set":{"mpcDyn":true},"panes":[["yawr","yawk"],["cte"]],"layers":{"slip":true}}] [try: Analyze, tyre model | {"level":6,"set":{"mpcDyn":true},"test":"step","stepKind":"offset","stepAmp":0.05}]

**What it does not do.** It reads $v_y$ and $r$ from the simulator. A real car would have a gyro for $r$ and an estimate of $v_y$. Its tyres are those of the simulator, linear up to a hard limit, so it matches the simulated car by construction. A model of real tyres is never that accurate. It also does not brake for a swerve it cannot make. With μ 0.1 it hits the first box at full speed, like the kinematic MPC. Its cost holds the speed to the reference, and with the tyres saturated, slowing down pays off only late in the horizon. Keeping the reference speed within the grip, $v \le \sqrt{\mu g/\kappa}$, is still the speed profile's job.
