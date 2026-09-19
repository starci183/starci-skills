#!/usr/bin/env bash
# v10-5 wait loop: poll for v10-1..v10-4 done markers every 60s
cd "D:/Repositories/starci-academy-backend/.claude"
echo "wait began $(date '+%H:%M:%S')"
deadline=$(( $(date +%s) + 4*3600 ))
while true; do
  n=0; missing=""
  for lane in v10-1 v10-2 v10-3 v10-4; do
    if [ -f "ex-testing/lint/done/$lane.done" ]; then n=$((n+1)); else missing="$missing $lane"; fi
  done
  echo "$(date '+%H:%M:%S') $n/4 present; missing:$missing"
  [ "$n" -eq 4 ] && { echo "ALL DONE $(date '+%H:%M:%S')"; exit 0; }
  [ "$(date +%s)" -gt "$deadline" ] && { echo "TIMEOUT $(date '+%H:%M:%S')"; exit 1; }
  sleep 60
done
