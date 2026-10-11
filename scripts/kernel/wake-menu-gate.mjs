// wake-menu-gate.mjs — no wake without work: a wake of a Kernel seat is typed only while the Kernel's menu holds an item.
//
// The watchdog's stall wake already asks `starci kernel status` and stays quiet on `frontier.actionable === false` (kernel-watchdog-tick.mjs).
// The durable transition wakes (a filed report, an answered ask, a landed foundation, a peer message) and the doorbell reach the Kernel by
// another way, wake-delivery.mjs, and each re-reads the whole session of the seat: when the runtime settles the transition itself the menu is
// still empty and the wake finds nothing to decide. This gate asks the same question of the same projection before any of them is typed;
// an empty menu writes one `kernel-wake-skipped` event (cause, reason) that the seat-cost view counts, and the wake is not sent. A probe that
// cannot answer lets the wake through (a lost wake costs more than an empty one). The probe runs once: its child carries STARCI_WAKE_PROBE.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNode } from '../api/node/run-node.mjs';
import { jsonFromStdout } from '../lib/json.mjs';
import { readEnv } from '../lib/env.mjs';
import { seatCostConfig } from './seat-wakes.mjs';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cli.mjs');
const PROBE_FIELDS = 'frontier.actionable,frontier.reason,menu';
const PROBE_TIMEOUT_MS = 60_000;

/** What the status fields say: {hold, reason}. Only an explicit `actionable: false` with an empty menu holds a wake. Pure. */
export function menuVerdict(fields) {
  if (fields?.['frontier.actionable'] !== false) return { hold: false, reason: null };
  const menu = fields.menu;
  if (Array.isArray(menu) && menu.length > 0) return { hold: false, reason: null };
  return { hold: true, reason: fields['frontier.reason'] ?? 'the menu holds no item' };
}

/** The read-only status probe of one workflow: {ok, fields} or {ok:false, error}. */
export function probeMenu({ repo, workflowId, run = runNode, env = process.env }) {
  const result = run([CLI, 'status', '--repo', repo, '--workflow', workflowId, '--field', PROBE_FIELDS, '--json'], { timeout: PROBE_TIMEOUT_MS, env: { ...env, STARCI_WAKE_PROBE: '1' } });
  const value = jsonFromStdout(result.stdout);
  if (result.status !== 0 || !value?.fields) return { ok: false, error: String(result.error?.message ?? result.stderr ?? 'status probe failed').slice(0, 200) };
  return { ok: true, fields: value.fields };
}

/** The repository root a ledger file belongs to (<repo>/.starciwork/runtime.sqlite). */
export const repoOfLedger = (ledger) => (ledger?.file ? path.dirname(path.dirname(ledger.file)) : null);

/**
 * `send()` unless the Kernel's menu is empty. `deps.menuProbe` answers {ok, fields}; the default probe is the real status child, skipped inside a probe
 * child, when the ledger names no repository and when the caller replaced the host seams (`deps.show|read|send`, a spec) without a probe. Returns {sent: true, answer} or {sent: false, answer: {action: 'kernel-no-menu', delivered: false, reason}}.
 */
export function gatedWake(ledger, { workflowId, cause, send, deps = {}, env = process.env }) {
  const repo = repoOfLedger(ledger);
  const probe = deps.menuProbe ?? null;
  const seamsReplaced = Boolean(deps.show || deps.read || deps.send) && !probe;
  if (seamsReplaced || readEnv('STARCI_WAKE_PROBE', env) || (!probe && !repo)) return { sent: true, answer: send() };
  const seen = (probe ?? (() => probeMenu({ repo, workflowId, env })))();
  const verdict = seen.ok ? menuVerdict(seen.fields) : { hold: false };
  if (!verdict.hold) return { sent: true, answer: send() };
  try {
    ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, kind: seatCostConfig().kernel.skipped, payload: { cause, reason: String(verdict.reason).slice(0, 200) } }));
  } catch { /* the withheld wake is still not sent */ }
  return { sent: false, answer: { action: 'kernel-no-menu', delivered: false, reason: verdict.reason } };
}
