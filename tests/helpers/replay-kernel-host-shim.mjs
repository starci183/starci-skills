// Recorded OS engine/services boundary of the prompt-delivery replay. No host probes or actuators.
import assert from 'node:assert/strict';
import path from 'node:path';
import { readMachine, TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { main as workflowUp } from '../../scripts/reconciler/workflow-up.mjs';
import { ensureHostRuntime, sqliteItem, hostPlatformItem, ledgerIntegrity } from '../../scripts/reconciler/start.mjs';
import { engineItems, serviceItems } from '../../scripts/reconciler/start-items.mjs';
import { guardCommandRow } from '../../scripts/reconciler/guard-row.mjs';
import { green, red } from '../../scripts/reconciler/checklist-items.mjs';
import { PROFILES } from '../../scripts/reconciler/state.mjs';
export async function execNode(argv, { env }) {
  assert.equal(path.basename(argv[0]), 'workflow-up.mjs');
  assert.equal(env.USERPROFILE, process.env.USERPROFILE);
  assert.ok(env[TEST_REGISTRY_ENV] && env[TEST_REGISTRY_ENV].startsWith(path.dirname(env.USERPROFILE)), 'only the private machine registry is readable');
  let stdout;
  await workflowUp(argv.slice(1), { env, print: (value) => { stdout = value; },
    ensureHostRuntime: (opts) => ensureHostRuntime(opts, {
      gather: () => {
        const machine = readMachine((m) => ({ check: m.db.prepare('PRAGMA quick_check').get()?.quick_check, ledgers: m.listLedgers() }), null, { env });
        const integrity = ledgerIntegrity(machine?.ledgers ?? []);
        const healthy = machine?.check === 'ok' && integrity.checked > 0 && integrity.bad.length === 0;
        const database = healthy ? green('preflight', 'machine-db', 'isolated machine and ledger integrity', 'native quick_check ok')
          : red('preflight', 'machine-db', 'isolated machine and ledger integrity', 'native quick_check failed');
        const modes = Object.fromEntries(Object.entries(PROFILES.operational).map(([name, mode]) => [name, { configured: mode, effective: mode }]));
        const engine = { leader: { fresh: true, holder: 'recorded-replay-engine', pid: 1, epoch: 1, ageMs: 0, safe: false }, modes, drift: { modes: [], rev: null } };
        const probes = ['orca', 'ask-gateway', 'ask-tunnel', 'telegram-bridge', 'harness-ui', 'harness-tunnel'].map((name) => ({ name, ok: true, detail: { status: 'recorded replay observation' } }));
        return [sqliteItem(), hostPlatformItem(), guardCommandRow(), database, ...engineItems(engine), ...serviceItems(probes)];
      },
      applyHost: () => { throw new Error('replay host actuator forbidden'); }
    }) });
  return { stdout, stderr: '', error: process.exitCode === 0 ? null : { code: 1, message: 'recorded host prerequisites refused' } };
}
