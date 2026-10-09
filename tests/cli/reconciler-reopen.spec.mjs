import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { main } from '../../scripts/cli/main.mjs';
import { seatQuarantine } from '../../scripts/reconciler/host-seats.mjs';

// A quarantined seat is reopened by a starci verb, which the Decision Item of the quarantine names.
test('starci reconciler reopen resolves to the services reopen command with the row name', () => {
  const calls = [];
  const runScript = (script, args) => { calls.push({ script, args }); return 0; };
  assert.equal(main(['reconciler', 'reopen', 'seat:kernel:led:wf-1', '--json'], { catalog, runScript }), 0);
  assert.equal(calls.length, 1);
  assert.equal(path.basename(calls[0].script), 'services.mjs');
  assert.equal(path.basename(path.dirname(calls[0].script)), 'reconciler');
  assert.deepEqual(calls[0].args, ['--reopen', 'seat:kernel:led:wf-1', '--json']);
  assert.deepEqual(catalog.groups.reconciler.verbs.reopen.roles, ['lead', 'owner']);
  assert.equal(main(['reconciler', 'reopen'], { catalog, stderr: () => {}, runScript }), 2, 'a name is required');
});

test('the Decision Item of a quarantined seat offers the starci verb, not a raw script', async () => {
  const opened = [];
  const ctx = { openDecision: async (item) => { opened.push(item); } };
  const di = (item) => item;
  await seatQuarantine(ctx, { key: 'seat:kernel:led:wf-1', rec: { state: 'live' }, next: { restarts: [] }, ledgerId: 'led', workflowId: 'wf-1', action: 'start-held', now: 1 }, { di });
  assert.equal(opened[0].options[0].verb, 'starci reconciler reopen seat:kernel:led:wf-1');
});
