# Training the learned blocks

The page runs its learned blocks in plain JavaScript with weights inlined by the build (`src/models/*.json`: the
detector and the predictor about 70 KB each, the policy 745 KB). The built-in models were trained here, offline, in Python: this is the one place Python enters
the project.

They can also be retrained in the page itself: **Tools → Train** collects the data in workers with the same core code
(`src/core/dataset.js`, which the collectors below call too), trains in plain JavaScript (`src/core/nn-train.js`:
backpropagation and Adam, split over workers), compares the result with the built-in model on a held-out run, and
keeps trained models in the browser (IndexedDB); Perceive → Detector model, Perceive → Predictor model and Plan →
Policy model pick one. The
sources can be levels, maps painted in the page (saved setups) or random obstacles, with the level's, placed or random
goals. A model saved there as JSON has the format of `src/models/<block>.json`, its reference (below) included, and can
replace the built-in one.
JavaScript is several times slower than PyTorch, so large datasets and long runs are still better done here.

- Data comes from the headless core: `node tools/collect-detector.mjs` runs the levels that have people and writes
  `training/data/` (not committed; a minute to regenerate). The collectors take `--gen` (generator families, or a
  spec as JSON) to run on generated worlds instead of the levels.
- Set up once: `uv venv` (or `python3 -m venv .venv`), then `uv pip install --python .venv/bin/python torch numpy`.
- Train: `source .venv/bin/activate && python3 training/detector/train.py`. It prints precision and recall on three
  held-out runs (one per map condition) and writes `src/models/detector.json`; rebuild the page with `./build.sh`.
- Reference: the model the trainer writes has no `ref`, the statistics of its inputs over the training runs that the
  page's out-of-distribution monitor scores every input against (`src/core/learnmon.js`). The description it is
  computed from is the core's (`oodDesc`), so it is not computed in Python: `tools/ood-ref.mjs` replays the runs the
  model file lists under `trained_on` on the headless core just built and writes `ref` into the model file. After the
  build above (which warns that the model has no ref):

      node tools/ood-ref.mjs detector
      ./build.sh

  The same with `predictor` or `policy` (the policy's runs are the collector recipes in `training/policy/README.md`,
  with the policy just built driving the DAgger ones). Without it `tests/node/learnmon.test.mjs` fails. It replays
  runs on the levels only: a detector or predictor trained on `--gen` data cannot be replayed yet, and the policy's
  reference comes from the level recipes whatever it was trained on.

- The people predictor: `training/predictor/README.md` (collect with `tools/collect-pred.mjs`, train with
  `training/predictor/train.py`).
- The end-to-end policy: `training/policy/README.md` (collect with `tools/collect-policy.mjs`, including DAgger
  rounds that need the current policy built into the page).

Each block's folder has its own notes: what the network sees, what it is trained against, what the lesson measures.
