#!/bin/bash
# Watch only the 4 still-running v2 lanes; exit when all reach prompt (DONE) or die.
declare -A T=( [term_8a4f1764-563f-4068-9dc8-ab1a8ba25a69]=r1 [term_2aace428-59fb-4621-8965-295c819083c0]=r2 [term_a238c7ea-b34c-4566-a231-59546d5c9a48]=q3 [term_1564f69c-21d0-4dcc-88dc-7688764a4bd4]=q9 )
while :; do
  alive=0
  for t in "${!T[@]}"; do
    s=$(orca terminal read --terminal "$t" --screen 2>/dev/null | tail -12)
    if echo "$s" | grep -q "Thinking\|Running tools\|Working"; then alive=$((alive+1)); fi
  done
  [ "$alive" -eq 0 ] && echo "ALL-DONE $(date +%T)" && exit 0
  sleep 60
done
