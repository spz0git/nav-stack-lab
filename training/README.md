# Training the learned blocks

The page runs its learned blocks in plain JavaScript with weights inlined by the build (`src/models/*.json`, a few
tens of kilobytes each). Training happens here, offline, in Python: this is the one place Python enters the project.

- Data comes from the headless core: `node tools/collect-detector.mjs` runs the levels that have people and writes
  `training/data/` (not committed; a minute to regenerate).
- Set up once: `uv venv` (or `python3 -m venv .venv`), then `uv pip install --python .venv/bin/python torch numpy`.
- Train: `source .venv/bin/activate && python3 training/detector/train.py`. It prints precision and recall on a
  held-out run and writes `src/models/detector.json`; rebuild the page with `./build.sh`.

Each block's folder has its own notes: what the network sees, what it is trained against, what the lesson measures.
