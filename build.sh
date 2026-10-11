#!/bin/sh
# Build the single-file artifact and the page used by the tests.
set -e
cd "$(dirname "$0")"
node build.mjs
python3 tests/wrap.py
