// release-l4-schedule.mjs - the order the L4 rows of a release cut run in: a graph of rows with the pool each one runs in, not a line.
// A row starts when every row it waits for has settled and its pool has a free place. A row that is red or throws never cancels a row already started; after a throw
// nothing new is started and the first error is raised once the running rows have settled (a red row is a result, a throw is a bug). The pools and their sizes are declared in
// modules/supervisor/release-cut.yaml; the size of the app chain pool is also bounded by what the host has free right now (appChainLimit).
import os from 'node:os';
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { machineLoad, memoryProbe } from '../machine/host-resources.mjs';

const GIB = 1024 ** 3;

/** The declared schedule of release-cut.yaml. */
export const scheduleSettings = () => readModuleJson('modules', 'supervisor', 'release-cut.yaml').schedule;

/** Check the graph before it runs: unique ids, every `after` known, a pool with a size. Throws on a graph that could never finish. */
function checkGraph(rows, limits) {
  const ids = new Set();
  for (const row of rows) {
    if (ids.has(row.id)) throw new Error(`release schedule: row ${row.id} is listed twice`);
    ids.add(row.id);
  }
  for (const row of rows) {
    const unknown = row.after.filter((id) => !ids.has(id));
    if (unknown.length) throw new Error(`release schedule: ${row.id} waits for ${unknown.join(', ')}, which is not a row`);
    if (!(row.pool in limits)) throw new Error(`release schedule: ${row.id} runs in the pool ${row.pool}, which has no size`);
  }
}

/** Memoise a function of no arguments: the first call decides. */
export function once(fn) {
  let box = null;
  return () => {
    box ??= { value: fn() };
    return box.value;
  };
}

/**
 * Run `rows` ([{id, pool, after: [ids], run}]) under `limits` ({pool: size or a function giving it}). `run` may return a value or a promise.
 * Resolves with a Map id -> result once every row has settled; rejects with the first thrown error after the running rows settled.
 */
export function runGraph(rows, limits) {
  checkGraph(rows, limits);
  return new Promise((resolve, reject) => {
    const results = new Map(), state = new Map(rows.map((row) => [row.id, 'waiting'])), running = {};
    const fault = { error: null, raised: false };
    let live = 0;
    const size = (pool) => (typeof limits[pool] === 'function' ? limits[pool]() : limits[pool]);
    const ready = (row) => state.get(row.id) === 'waiting' && row.after.every((id) => state.get(id) === 'done') && (running[row.pool] ?? 0) < size(row.pool);
    const settle = (row) => {
      running[row.pool] -= 1;
      live -= 1;
      state.set(row.id, 'done');
      pump();
    };
    const start = (row) => {
      state.set(row.id, 'running');
      running[row.pool] = (running[row.pool] ?? 0) + 1;
      live += 1;
      Promise.resolve().then(row.run).then(
        (value) => { results.set(row.id, value); settle(row); },
        (error) => { fault.raised = true; fault.error ??= error; settle(row); },
      );
    };
    const finish = () => {
      if (fault.raised) { reject(fault.error); return; }
      const stuck = rows.filter((row) => state.get(row.id) === 'waiting').map((row) => row.id);
      if (stuck.length) reject(new Error(`release schedule: ${stuck.join(', ')} could not start`)); else resolve(results);
    };
    function pump() {
      if (fault.raised) { if (live === 0) finish(); return; }
      for (const row of rows) if (ready(row)) start(row);
      if (live === 0) finish();
    }
    pump();
  });
}

/**
 * How many app chains may run together: the declared pool size, lowered to what the host has free (logical threads and RAM above the reserve of the test concurrency policy),
 * at least one. `deps.hostSample` replaces the probe in specs. Pure over the sample.
 */
export function appChainLimit({ settings = scheduleSettings(), deps = {} } = {}) {
  const declared = settings.pools.apps;
  const policy = readModuleJson('modules', 'supervisor', 'test-concurrency.yaml');
  let sample;
  try {
    sample = (deps.hostSample ?? (() => ({ ...machineLoad({ sampleMs: policy.sampleMs }), ...memoryProbe(), logicalThreads: os.availableParallelism() })))();
  } catch {
    return 1;
  }
  const { logicalThreads, cpuBusy, totalRamBytes, freeRamBytes } = sample ?? {};
  if (![logicalThreads, cpuBusy, totalRamBytes, freeRamBytes].every(Number.isFinite)) return 1;
  const reserve = Math.max(policy.minimumReserveGiB * GIB, totalRamBytes * policy.reserveRamPct / 100);
  const cpu = Math.floor(logicalThreads * (1 - cpuBusy) / settings.appChain.logicalThreads);
  const ram = Math.floor(Math.max(0, freeRamBytes - reserve) / (settings.appChain.ramGiB * GIB));
  return Math.max(1, Math.min(declared, cpu, ram));
}
