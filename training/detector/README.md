# The learned people detector

A 1D convolutional network over the 120 lidar beams (circular padding) that labels each beam "person" or "static".
Lesson 7 of the perception group and chapter 3 §9 explain it; this folder trains it.

- Data: `node tools/collect-detector.mjs` (every scan of 36 headless runs on L5 and L6, seeds 21–38, scripted and
  reacting people, three map conditions in turn: the prior map, the map built by lidar, and the prior map with
  dead-reckoning drift; labels from the true poses and discs; 43 000 scans, 3.7 % person beams) into
  `training/data/`, not committed. The seeds start at 21 so that the lessons' seeds are runs the model has not seen.
- Train: `python3 training/detector/train.py` (60 epochs with a cosine learning-rate decay, about thirteen minutes on
  a laptop CPU; the last three runs are held out, one per condition, and precision and recall at the page's
  threshold of 0.8 are printed for each) writes `src/models/detector.json` (8 185 parameters, 70 KB, with the
  threshold and the fewest beams per detection, one), which `./build.sh` inlines; the page runs it with `nnForward`
  in `src/core/nn.js`. Then its out-of-distribution reference: `node tools/ood-ref.mjs detector` on that build, and
  `./build.sh` again (`training/README.md`).
- Inputs per beam: range/8, the previous scan reprojected through the odometry into the current frame /8, their
  difference clipped to ±1, the hit flag, v/1.5 and ω/2, and the map evidence (how well the robot's map explains
  the hit, 0 to 1: the rule's test kept as a number, `detStatic`), built by `detFeatures` in `src/core/agents.js`,
  which the page, the collector (through `collectRun` in `src/core/dataset.js`) and the Train tab all call, so they
  cannot disagree. A model of six channels (trained before the map evidence) still runs: the page builds the
  features its first layer expects.
- Why the map evidence and why the three conditions: without it the network had to tell a wall from a person by
  shape and by the change since the last scan, and that change is noisy on walls (7–9 % of wall beams move more
  than 15 cm between scans even with perfect odometry, from re-binning at grazing angles and occlusion edges), so it
  lost to the map-based rule wherever there was a map. With it and only prior-map runs it would learn to copy the
  rule and fail where the rule fails; the built map and the drift runs teach it when the evidence is weak or wrong.
- The same training runs in the page: Tools → Train (see `training/README.md`).
