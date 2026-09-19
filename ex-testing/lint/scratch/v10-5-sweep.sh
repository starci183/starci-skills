#!/usr/bin/env bash
# v10-5 final sweep: run every check, capture tail/summary lines.
# Usage: bash ex-testing/lint/scratch/v10-5-sweep.sh <outdir>
cd "D:/Repositories/starci-academy-backend/.claude"
OUT="${1:-ex-testing/lint/scratch/v10-5-sweep}"
mkdir -p "$OUT"
TODO=examples/todo-app-backend/.starciwork
EC=examples/ecommerce-app-be/.starciwork

run() { # name, command...
  local name="$1"; shift
  echo "=== $name : $* (start $(date '+%H:%M:%S'))"
  "$@" > "$OUT/$name.txt" 2>&1
  echo "$name exit=$? lines=$(wc -l < "$OUT/$name.txt")"
  tail -3 "$OUT/$name.txt"
}

run yaml            node scripts/check-example-yaml.mjs
run gate            node scripts/check-example-work.mjs
run derived         node scripts/check-example-derived.mjs
run deep            node scripts/check-work-deep.mjs
run replay-dryrun   node scripts/check-work-replay.mjs
run surfaces        node scripts/check-work-surfaces.mjs
run history         node scripts/check-work-history.mjs
run consistency     node scripts/check-work-consistency.mjs
run artifacts       node scripts/check-work-artifacts.mjs
run layout-todo     node cli/main.mjs work-layout check --work "$TODO"
run layout-ec       node cli/main.mjs work-layout check --work "$EC"
echo "sweep done $(date '+%H:%M:%S')"
