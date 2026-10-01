// launched-terminals.mjs - which Dispatch a runtime-launched agent terminal is (deep map T3/W7 follow-up, lane ORCA).
// The depth preflight needs the Dispatch of the ENTRY terminal that starts a nested worker (an op starting its critic, a
// Kernel started from a worker). Orca's `worker-list` cannot answer it: without --run it lists only the Run bound to the
// calling terminal, and a nested worker's own Dispatch lives in its PARENT's Run, so the caller never sees itself (live
// smoke 2026-10-02: with d1 and d2 running, the list held d1 only and the preflight resolved depth 1 for a depth-4 entry).
// Scanning every Run costs about 0.7 s each, so the runtime records what it launched: spawnAgent writes {terminal ->
// dispatchId} here the moment the worker is attested, and entryDispatchOf reads it first. It is lineage Orca does not
// expose, not worker custody (Orca's worker-list/worker-release stay the custody authority). The file lives in the
// per-host state root (engine/db/machine.mjs starciLocalRoot), entries expire after a week, and a missing or
// unreadable file proves nothing (the caller falls back to worker-list).
import fs from 'node:fs';
import path from 'node:path';
import { starciLocalRoot } from '../../engine/db/machine.mjs';

const FILE = 'launched-terminals.json';
const TTL_MS = 7 * 24 * 3600 * 1000;
const fileOf = (env) => path.join(starciLocalRoot(env), FILE);
const read = (file) => { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; } };

/** Record that `terminal` is the agent terminal of `dispatchId`. Never throws (a launch must not fail on bookkeeping). */
export function recordLaunchedTerminal({ terminal, dispatchId, env = process.env, now = Date.now() }) {
  if (!terminal || !dispatchId) return false;
  if (env.NODE_TEST_CONTEXT && !env.STARCI_LOCAL_ROOT) return false; // a spec never writes the host's real state root
  try {
    const file = fileOf(env);
    const rows = read(file);
    for (const [handle, row] of Object.entries(rows)) if (!(now - Number(row?.at) < TTL_MS)) delete rows[handle];
    rows[terminal] = { dispatchId, at: now };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(rows));
    fs.renameSync(tmp, file);
    return true;
  } catch { return false; }
}

/** The Dispatch the runtime recorded for `terminal`, or null. */
export function launchedDispatchOf(terminal, { env = process.env, now = Date.now() } = {}) {
  if (!terminal) return null;
  const row = read(fileOf(env))[terminal];
  return row?.dispatchId && now - Number(row.at) < TTL_MS ? row.dispatchId : null;
}
