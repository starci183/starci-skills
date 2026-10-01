// launch-smoke-hold.mjs - keeps the smoke's Kernel agent alive until the smoke's own op (opFail) has settled.
// A Kernel that reports worker_done first settles its Dispatch, and Orca then no longer treats a worker started from
// its terminal as nested (live smoke 2026-10-01: opFail came up at depth 1). The Kernel's `stage` therefore waits here
// after it started its children; the smoke driver writes the release file once opFail is preserved and reset (or the
// workflow leg can no longer reach it). The wait is bounded, so a driver that died never leaves the Kernel waiting.
import fs from 'node:fs';
import path from 'node:path';

const releaseFile = (state, role) => path.join(state, 'stages', `${role}.release`);

/** The driver lets the parent `role` finish its stage. */
export function releaseStageHold(state, role) {
  try { fs.mkdirSync(path.dirname(releaseFile(state, role)), { recursive: true }); fs.writeFileSync(releaseFile(state, role), `${Date.now()}\n`); } catch { /* a missing state directory holds nothing */ }
}

/** Wait up to `holdMs` for the driver's release; true when it came. holdMs 0 waits for nothing (the specs). */
export async function holdStage({ state, role, holdMs, sleep, now = Date.now }) {
  for (const deadline = now() + holdMs; now() < deadline;) {
    if (fs.existsSync(releaseFile(state, role))) return true;
    await sleep(1000);
  }
  return fs.existsSync(releaseFile(state, role));
}
