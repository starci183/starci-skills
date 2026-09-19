#!/usr/bin/env bash
# Fleet v2 watchdog: exits on first actionable event so trò wakes and acts.
STATUS_FILE="D:/Repositories/starci-academy-backend/.claude/ex-testing/FLEET-STATUS.md"
LOG="D:/Repositories/starci-academy-backend/.claude/ex-testing/watchdog.log"
LANES_FILE="D:/Repositories/starci-academy-backend/.claude/ex-testing/lanes-v2.txt"
PROC_DIR="D:/Repositories/starci-academy-backend/.claude/ex-testing/.processed-v2"
mkdir -p "$PROC_DIR"

declare -A LANES
while read -r h name; do LANES[$h]=$name; done < "$LANES_FILE"
NLANES=${#LANES[@]}

declare -A PREV_CTX STALL_SINCE
now() { date +%s; }
EVENT=""

while [ -z "$EVENT" ]; do
  TS=$(date '+%H:%M:%S')
  OUT="# Fleet v2 status — $TS"$'\n\n'"| Lane | State | Context | Detail |"$'\n'"|---|---|---|---|"
  NDONE=0
  for h in "${!LANES[@]}"; do
    lane=${LANES[$h]}
    scr=$(orca terminal read --terminal "$h" --screen 2>&1 | tail -30)
    state="?"; detail=""
    if echo "$scr" | grep -q "trust the authors"; then state="NEED-TRUST"; detail="trust prompt";
    elif echo "$scr" | grep -qi "approve once\|always allow\|bypass mode"; then state="NEED-PERM"; detail="permission menu";
    elif echo "$scr" | grep -qi "API Error\|401\|Invalid API-key"; then state="CRASH"; detail=$(echo "$scr" | grep -i "error\|401" | head -1 | head -c 80);
    elif echo "$scr" | grep -q "Thinking ·\|Running tools ·\|Running command\|Writing ·"; then state="WORKING";
    elif echo "$scr" | grep -q "Ask Devin to build features"; then state="DONE"; detail=$(echo "$scr" | grep -oiE "[0-9]+ passed|[0-9]+ failed|Blocker[^\n]*" | tail -2 | tr '\n' ' ' | head -c 100);
    elif echo "$scr" | grep -q "Guide Devin while it works"; then state="IDLE?"; detail="no spinner";
    elif echo "$scr" | grep -q "PS D:\|exited"; then state="EXITED"; detail="shell only";
    else state="UNKNOWN"; fi
    ctx=$(echo "$scr" | grep -o "Context: [0-9]*k / [0-9]*k tokens ([0-9]*%)" | tail -1)
    [ -z "$ctx" ] && ctx="-"
    n=$(now)
    if [ "$state" = "WORKING" ] && [ "${PREV_CTX[$h]}" = "$ctx" ]; then
      [ -z "${STALL_SINCE[$h]}" ] && STALL_SINCE[$h]=$n
      stall=$(( (n - ${STALL_SINCE[$h]}) / 60 ))
      [ $stall -ge 8 ] && state="STALL?" && detail="ctx unchanged ${stall}m"
    else
      STALL_SINCE[$h]=""
    fi
    PREV_CTX[$h]=$ctx
    OUT+=$'\n'"| $lane | $state | $ctx | $detail |"
    if [ "$state" = "NEED-TRUST" ] || [ "$state" = "NEED-PERM" ] || [ "$state" = "STALL?" ] || [ "$state" = "CRASH" ]; then
      EVENT="$lane $state $detail"
    elif [ "$state" = "DONE" ] && [ ! -f "$PROC_DIR/$lane" ]; then
      touch "$PROC_DIR/$lane"; EVENT="$lane DONE $detail"
    fi
    [ "$state" = "DONE" ] && NDONE=$((NDONE+1))
  done
  echo "$OUT" > "$STATUS_FILE"
  echo "[$TS] done=$NDONE/$NLANES" >> "$LOG"
  [ $NDONE -eq $NLANES ] && EVENT="ALL-DONE"
  [ -z "$EVENT" ] && sleep 45
done
echo "=== WATCHDOG EVENT ==="
echo "$EVENT"
cat "$STATUS_FILE"
