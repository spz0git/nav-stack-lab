# The learned people predictor

A multilayer perceptron that reads one tracked person's last second and gives three futures for the next 3 s, each
with a probability. Lesson 8 of the perception group and chapter 3 §10 explain it; this folder trains it.

- Data: `node tools/collect-pred.mjs` (every scan of 48 headless runs of 150 s on L5 and L6, seeds 21–44, people
  scripted and reacting in turn, the robot yielding with the speed planner and ignoring people in turn, the mission
  looping; each confirmed lidar track within 0.8 m of a person is a sample; 84 760 samples, about a minute) into
  `training/data/`, not committed. The last two seeds of each level are written last and held out. The seeds start at
  21 so that the lessons' seeds are runs the model has not seen.
- Train: `python3 training/predictor/train.py [--epochs 60] [--sigma 0.3] [--hidden 64]` (ten seconds on a laptop
  CPU) prints, for each held-out run, the error at 1 s and 2 s of constant velocity, of the most probable future
  and of the best of the three, and writes `src/models/predictor.json` (8 295 parameters, 67 KB, with K, the horizon
  and σ), which `./build.sh` inlines; the page runs it with `mlpForward` in `src/core/nn.js`.
- Inputs (24), built by `predFeatures` in `src/core/predict.js`, which the page, the collector (through `collectRun`
  in `src/core/dataset.js`) and the Train tab all call: in the person's frame (origin at the track, x along the last
  second's displacement, towards the robot when standing), five past positions at 0.2…1 s ago, the tracked
  velocity, the robot's position /4 (clipped at 8 m) and velocity, and free space along eight rays in the robot's map
  /4 (clipped at 4 m).
- Outputs (39): three logits, then for each future six points (0.5…3 s) of (x, y) minus the constant-velocity point.
  Zeros are constant velocity.
- Labels: where the person really was, seen through the robot's pose estimate of the moment of the sample (the true
  displacement from the true robot pose, placed at the estimated one), so that a localization error is not taught as
  the person's motion; minus the constant-velocity points.
- Loss: the negative log-likelihood of a mixture of three Gaussians of fixed σ (the same as `mixLoss` in
  `src/core/nn-train.js`, which the Train tab uses). Smaller σ gives more distinct futures (a better best of three)
  and a worse most probable one; σ = 0.2, 0.3 and 0.5 are compared in chapter 3 §10.
- What it learned is mostly the lidar tracker: with ground-truth tracks constant velocity is better. See lesson 8.
- The same training runs in the page: Tools → Train (see `training/README.md`).
