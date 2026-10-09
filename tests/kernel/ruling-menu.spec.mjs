// A Supervisor ruling is a fact the Kernel receives on its menu, not a line only the doorbell carries: it was excluded from the menu as the runtime's
// own kind, so a Kernel whose menu was otherwise empty never saw the ruling it was woken for (StarCi di-498134c6, 13:36).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { openLedger } from '../../engine/db/ledger.mjs';
import { openDecisionRow, listDecisions } from '../../scripts/machine/decisions.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CLI = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const WF = 'wf-ruling';
const envOf = (world) => ({ ...process.env, [TEST_REGISTRY_ENV]: world.machineFile, STARCI_LOCAL_ROOT: world.machineHome, STARCI_AUTOPILOT: 'off', ORCA_TERMINAL_HANDLE: '' });
const cli = (world, ...args) => spawnSync(process.execPath, [CLI, ...args, '--repo', world.repoRoot], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 180_000, env: envOf(world) });

test('a ruling is on the Kernel menu with an acknowledge choice that closes it', (t) => withLedger(t, (world) => {
  const { ledger } = world;
  seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'ruling' }, goalIdentity: 'g', goal: { revision: 0, identity: 'g', markdown: '# goal', json: {} }, jobs: [] });
  const ruling = openDecisionRow(ledger, { workflowId: WF, kind: 'supervisor-ruling', entity: { type: 'workflow', id: WF }, summary: '[supervisor] widen nothing: an SDS gap, not a narrow grant', by: 'supervisor' }, { now: Date.now() - 60_000 }).di;
  ledger.close();
  const out = JSON.parse(cli(world, 'status', '--workflow', WF, '--json').stdout);
  const [item] = out.menu;
  assert.equal(item?.id, `decision-item:${ruling.id}`, 'the ruling is an item of the menu');
  assert.match(item.question, /SDS gap/);
  assert.ok(item.options.some((option) => option.choice === 'acknowledge'));
  assert.equal(out.frontier.actionable, true, 'so the Kernel is woken for it');
  const answered = cli(world, 'decide', '--workflow', WF, '--item', item.id, '--choice', 'acknowledge', '--reason', 'read and applied', '--json');
  assert.equal(answered.status, 0, answered.stderr || answered.stdout);
  const reader = openLedger({ file: world.ledgerFile });
  try { assert.deepEqual(listDecisions(reader.db, { workflowId: WF }).filter((di) => di.id === ruling.id), [], 'the ruling is closed'); } finally { reader.close(); }
  assert.deepEqual(JSON.parse(cli(world, 'status', '--workflow', WF, '--json').stdout).menu, []);
}));
