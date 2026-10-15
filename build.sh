#!/bin/sh
# Build the single-file page (dist/nav-stack-lab.html) and the headless core (dist/core-worker.js).
set -e
cd "$(dirname "$0")"
node build.mjs
