# The end-to-end policy

A multilayer perceptron from the lidar scan, the odometry and the goal in the robot frame to eight waypoints along the
route, run in the page as a planner (Plan → Learned policy). Lesson 8 of the planning group and chapter 4 §10 explain
it and say plainly where it fails; this folder trains it.

- Data: `node tools/collect-policy.mjs expert expert 0.4 1,2,3,4,5,6,7,8 150` runs the classical stack to random goals
  on the levels without people with its commands perturbed and labels every scan with the A* route ahead; then, with
  the trained policy built into the page, `node tools/collect-policy.mjs dagger1 policy 0.1 11,12,13,14,15,16 120`
  lets the policy drive and labels its states (DAgger). Each call writes a tagged dataset into `training/data/`.
- Train: `python3 training/policy/train.py` uses every tagged dataset, holds the first one's last run out, reports the
  RMS error per waypoint in metres, and writes `src/models/policy.json` (105 744 parameters, 665 KB); rebuild with
  `./build.sh`. The features are built by `policyFeatures` in `src/core/planning-policy.js`, the same function the
  collector calls (through `collectRun` in `src/core/dataset.js`), so the two cannot disagree.
- The same training runs in the page: Tools → Train, where a DAgger round needs no rebuild (the policy picked in Plan
  drives).
