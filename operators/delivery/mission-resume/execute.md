# Execute `delivery/mission-resume`

## Step 1 — Bind completed backend work

**Read:** Validate the exact mission, impact and backend-proof receipts from the current task session.

**Context:** Verify one run, project, business head and routed source identity without reloading product source.

## Step 2 — Resume the owning mission

Emit one generic `delivery.mission.resume` transition carrying the proven backend role back to the mission-specific UI lane.

**Session write:** Keep the resume receipt and bound proof refs session-only.

**Stop:** Block on any run, route, authority or proof identity mismatch.

Orchestration may verify independent receipt hashes concurrently, but it may not fork or replace the owning mission.
