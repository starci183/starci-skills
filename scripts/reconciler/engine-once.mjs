// scripts/reconciler/engine-once.mjs — the one-pass run of the reconciler engine (`engine.mjs --once`, Engine.once): each
// non-off controller (or the named one) lists its keys, or reconciles one key, and drains its queue once, in order.
import { eachInOrder, repeatInOrder } from '../lib/in-order.mjs';
import { CONTROLLER_NAMES } from './state.mjs';

/** The keys one controller hands to a pass: `key` alone, else its list(); a list failure is recorded on `entry` and `out`. */
async function keysOf(engine, c, key, mode, entry, out) {
  if (key) return [key];
  try { return typeof c.module.list === 'function' ? await engine.als.run({ key: null }, () => c.module.list(engine.ctxFor(c, mode))) : []; }
  catch (error) { entry.listError = String(error?.message ?? error); out.ok = false; return []; }
}

/** Reconcile what `c` has queued, one concurrency-sized batch at a time, until the queue is empty. */
function drainQueue(engine, c, mode, entry) {
  return repeatInOrder(async () => {
    const batch = engine.queue.take(c.name, c.concurrency);
    if (!batch.length) return true;
    const results = await Promise.all(batch.map((item) => engine.reconcileOne(c, { ...item, attempts: 0 }, { mode })));
    for (const r of results) {
      if (r.ok) entry.ok += 1;
      else { entry.failed.push({ key: r.key, error: r.error }); engine.queue.done(c.name, r.key); }
    }
    return undefined;
  });
}

/** One controller's pass: the entry of its keys, successes and failures. */
async function passOf(engine, c, key, out) {
  const mode = engine.leader && c.mode === 'active' ? 'active' : 'shadow';
  const entry = { name: c.name, mode, keys: 0, ok: 0, failed: [] };
  const keys = await keysOf(engine, c, key, mode, entry, out);
  for (const k of Array.isArray(keys) ? keys : []) engine.queue.add(c.name, k, { reason: 'once' });
  entry.keys = Array.isArray(keys) ? keys.length : 0;
  await drainQueue(engine, c, mode, entry);
  if (entry.failed.length) out.ok = false;
  return entry;
}

/** Run `engine` once over its controllers. Returns {ok, epoch, leader, controllers: [...], coverage, loadErrors}. */
export async function runOnce(engine, { controller = null, key = null } = {}) {
  const expected = controller ? [controller] : CONTROLLER_NAMES.filter((name) => engine.modes[name] !== 'off');
  const loaded = new Set(engine.controllers.map((c) => c.name));
  const missing = expected.filter((name) => !loaded.has(name));
  const incomplete = engine.loadErrors.some((e) => e.name == null || expected.includes(e.name));
  const out = { ok: !incomplete && missing.length === 0, epoch: engine.epoch, leader: engine.leader, controllers: [],
    coverage: { expected: expected.length, loaded: expected.length - missing.length, missing },
    loadErrors: engine.loadErrors.map((e) => ({ name: e.name, error: e.error })) };
  const picked = engine.controllers.filter((c) => (controller ? c.name === controller : c.mode !== 'off'));
  if (controller && !picked.length) return { ...out, ok: false, error: `no controller '${controller}' (known: ${engine.controllers.map((c) => c.name).join(', ') || 'none'})` };
  await eachInOrder(picked, async (c) => { out.controllers.push(await passOf(engine, c, key, out)); });
  return out;
}
