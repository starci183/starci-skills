#!/usr/bin/env bash
# Fleet watchdog: polls all lane terminals, classifies state, writes FLEET-STATUS.md
STATUS_FILE="D:/Repositories/starci-academy-backend/.claude/ex-testing/FLEET-STATUS.md"
LOG="D:/Repositories/starci-academy-backend/.claude/ex-testing/watchdog.log"

declare -A LANES=(
 [X
 [term_ef491410-7c61-4fd5-90fc-085eacb47276]=ut-02-gql-mut-b
 [term_2b9da918-916d-431f-8f34-42d96e8a263b]=ut-03-gql-queries
 [term_337d08f8-3d15-48aa-9b49-2b72af532124]=ut-04-platform
 [term_656064b6-6a82-4f26-9ab5-7fc78b618b5b]=ut-05-int-shared
 [term_4afb3f57-6220-4b4d-b653-43475594edb2]=ut-06-bussiness
 [term_dd9616ab-ef54-47d4-928c-13cf0e6ceaed]=ut-07-ec-identity
 [term_d241de9e-7986-46ba-9300-cbbfaafd5e1e]=ut-08-ec-order
 [term_5e5a1c9d-8eb8-444d-a9c2-0c5ef5790241]=ut-09-ec-platform
 [term_f22f75fd-8a96-4f45-81f9-1f571fa98243]=ut-10-ec-wiring
 [term_fe3c9d2f-0f90-4c8f-880e-10bbcad3f447]=e2e-00-todo-infra
 [term_6b898d6e-3cb6-4e3a-880e-49926c556a2c]=e2e-01-todo-session
 [term_60780feb-3f3e-4b17-a8fc-9156924f5902]=e2e-02-todo-task
 [term_647fd104-66bf-406a-a730-36a3123b735a]=e2e-03-todo-recur
 [term_00049635-8346-44ea-877f-2d80b82f6e82]=e2e-04-todo-audit
 [term_ba264ab5-c2c5-4ac1-9c71-bbc8d36e3e4c]=e2e-05-todo-pns
 [term_b27bf787-897a-49e9-be8e-08c1cf17dbe7]=e2e-06-ec-infra
 [term_27fe81a9-f14b-4fe9-b689-b0c5476e7948]=e2e-07-ec-checkout
 [term_cc0380f7-1e0c-4e55-9f04-d861b9ef7d5f]=e2e-08-ec-order-lc
 [term_875d6438-1a46-4a2f-a96c-491f6e7215c4]=e2e-09-resilience
)

declare -A PREV_STATE PREV_CTX STALL_SINCE
PROC_DIR="D:/Repositories/starci-academy-backend/.claude/ex-testing/.processed"
mkdir -p "$PROC_DIR"
now() { date +%s; }
EVENT=""

while [ -z "$EVENT" ]; do
  TS=$(date '+%H:%M:%S')
  OUT="# Fleet status — $TS"$'\n\n'"| Lane | State | Context | Since | Detail |"$'\n'"|---|---|---|---|---|"
  NDONE=0
  for h in "${!LANES[@]}"; do
    lane=${LANES[$h]}
    scr=$(orca terminal read --terminal "$h" --screen 2>&1 | tail -30)
    state="?"; detail=""
    if echo "$scr" | grep -q "trust the authors"; then state="NEED-TRUST"; detail="trust prompt";
    elif echo "$scr" | grep -qi "approve once\|always allow\|bypass mode"; then state="NEED-PERM"; detail="permission menu";
    elif echo "$scr" | grep -q "Thinking ·\|Running tools ·\|Running command"; then state="WORKING";
    elif echo "$scr" | grep -qi "esc twice to interrupt"; then state="WORKING";
    elif echo "$scr" | grep -q "Ask Devin to build features"; then state="DONE"; detail=$(echo "$scr" | grep -oiE "[0-9]+ passed|[0-9]+ failed|Blocker[^\n]*" | tail -2 | tr '\n' ' ' | head -c 100);
    elif echo "$scr" | grep -q "Guide Devin while it works"; then state="IDLE?"; detail="no spinner";
    else state="UNKNOWN"; fi
    ctx=$(echo "$scr" | grep -o "Context: [0-9]*k / [0-9]*k tokens ([0-9]*%)" | tail -1)
    [ -z "$ctx" ] && ctx="-"
    # stall detection: WORKING but ctx unchanged for >5 min
    n=$(now)
    if [ "$state" = "WORKING" ] && [ "${PREV_CTX[$h]}" = "$ctx" ]; then
      [ -z "${STALL_SINCE[$h]}" ] && STALL_SINCE[$h]=$n
      stall=$(( (n - ${STALL_SINCE[$h]}) / 60 ))
      [ $stall -ge 5 ] && state="STALL?"; [ $stall -ge 5 ] && detail="ctx unchanged ${stall}m"
    else
      STALL_SINCE[$h]=""
    fi
    PREV_CTX[$h]=$ctx; PREV_STATE[$h]=$state
    OUT+=$'\n'"| $lane | $state | $ctx | - | $detail |"
    # event detection — exit so trò wakes up and acts
    if [ "$state" = "NEED-TRUST" ] || [ "$state" = "NEED-PERM" ] || [ "$state" = "STALL?" ]; then
      EVENT="$lane $state $detail"
    elif [ "$state" = "DONE" ] && [ ! -f "$PROC_DIR/$lane" ]; then
      touch "$PROC_DIR/$lane"; EVENT="$lane DONE $detail"
    fi
    [ "$state" = "DONE" ] && NDONE=$((NDONE+1))
  done
  echo "$OUT" > "$STATUS_FILE"
  echo "[$TS] done=$NDONE" >> "$LOG"
  [ $NDONE -eq 20 ] && EVENT="ALL-20-DONE"
  [ -z "$EVENT" ] && sleep 45
done
echo "=== WATCHDOG EVENT ==="
echo "$EVENT"
echo "--- last status ---"
cat "$STATUS_FILE"
