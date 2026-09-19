#!/bin/bash
# Poll v3 lanes; exit when all reach idle prompt or one stalls/crashes.
mapfile -t LANES < lanes-v3.txt
declare -A LAST IDLE
while :; do
  alive=0; report=""
  while read -r t n; do
    [ -z "$t" ] && continue
    s=$(orca terminal read --terminal "$t" --screen 2>/dev/null | tail -12)
    if echo "$s" | grep -q "Thinking\|Running tools"; then
      alive=$((alive+1)); IDLE[$t]=0
      ctx=$(echo "$s" | grep -o "([0-9]*%)" | tail -1)
      if [ "$ctx" = "${LAST[$t]}" ]; then IDLE[$t]=$(( ${IDLE[$t]:-0} + 1 )); else IDLE[$t]=0; fi
      LAST[$t]=$ctx
      [ "${IDLE[$t]:-0}" -ge 8 ] && { echo "STALL $n $ctx $(date +%T)"; exit 0; }
    elif echo "$s" | grep -qi "panic\|AssertionError\|ERR_MODULE\|401\|API Error"; then
      echo "CRASH $n $(date +%T)"; exit 0
    else
      report="$report $n"
    fi
  done <<< "$(printf '%s\n' "${LANES[@]}")"
  if [ "$alive" -eq 0 ]; then echo "ALL-DONE $(date +%T) — idle:$report"; exit 0; fi
  sleep 60
done
