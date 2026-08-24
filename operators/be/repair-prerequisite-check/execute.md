# Execute `be/repair-prerequisite-check`

## Step 1 — Validate and freeze

**Read:** complete input envelope. **Context:** none. Validate before resolving any reference. **Session write:** validated input ref. **Stop:** invalid or foreign task input.

## Step 2 — Resolve metadata

Resolve exactly the declared route, business, boundary and repair-finding metadata into task-session scratch storage.

## Step 3 — Compare prerequisite identities

Compare project/role/route identity, business authority and revision, boundary/approval plan hashes, baseline commit and finding boundary revision.

## Step 4 — Classify

Emit exactly one typed decision. Do not repair or broaden any prerequisite here.

## Step 5 — Validate output and cleanup

Validate the output and register all scratch references for terminal purge.

**Context:** no undeclared binding is allowed. **Session write:** output and evidence refs only. **Stop:** invalid or partially joined output. Orchestration is deterministic and sequential; no worker or model fan-out is permitted.
