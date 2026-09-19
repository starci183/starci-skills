#!/usr/bin/env bash
# v11-2 wait gate: poll for required lane markers every ~180s, max 60min
cd "D:/Repositories/starci-academy-backend/.claude"
echo "wait began $(date '+%H:%M:%S')"
deadline=$(( $(date +%s) + 3600 ))
lanes="v10-1 v10-2 v10-3 v10-4 v10-5 v9-2 v9-3 v9-4 v9-5 v9-6 v9-7 v9-8 v9-9 v9-10"
while true; do
  n=0; missing=""
  for lane in $lanes; do
    if [ -f "ex-testing/lint/done/$lane.done" ] || [ -f "ex-testing/lint/$lane-REPORT.md" ]; then
      n=$((n+1))
    else
      missing="$missing $lane"
    fi
  done
  echo "$(date '+%H:%M:%S') $n/14 satisfied; missing:$missing"
  [ -z "$missing" ] && { echo "ALL SATISFIED $(date '+%H:%M:%S')"; exit 0; }
  [ "$(date +%s)" -gt "$deadline" ] && { echo "TIMEOUT $(date '+%H:%M:%S') — proceeding anyway; missing:$missing"; exit 1; }
  sleep 180
done
