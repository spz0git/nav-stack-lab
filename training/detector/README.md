# The learned people detector

A 1D convolutional network over the 120 lidar beams (circular padding) that labels each beam "person" or "static".
Lesson 7 of the perception group and chapter 3 §9 explain it; this folder trains it.

- Data: `node tools/collect-detector.mjs` (every scan of 16 headless runs on L5 and L6, scripted and reacting people,
  labels from the true poses and discs; 19 200 scans, 3 % person beams) into `training/data/`, not committed.
- Train: `python3 training/detector/train.py` (40 epochs, four minutes on a laptop CPU; the last run is held out and
  precision and recall at the page's threshold of 0.6 are printed) writes `src/models/detector.json` (8 017 parameters,
  66 KB), which `./build.sh` inlines; the page runs it with `nnForward` in `src/core/nn.js`.
- Inputs per beam: range/8, the previous scan reprojected through the odometry into the current frame /8, their
  difference clipped to ±1, the hit flag, v/1.5 and ω/2, built by `detFeatures` in `src/core/agents.js`, which the
  page, the collector (through `collectRun` in `src/core/dataset.js`) and the Train tab all call, so they cannot
  disagree.
- The same training runs in the page: Tools → Train (see `training/README.md`).
