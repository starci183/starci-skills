// The host checklist row "command guard resolvable" runs the exact registered hook command: required, red when no shell resolves it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { guardCommandRow } from '../../scripts/reconciler/guard-row.mjs';
import { toolGuardCommand } from '../../scripts/lib/guard-command.mjs';

test('the row probes the exact command launch trust registers and is green when every shell that ran resolved it', () => {
  const seen = [];
  const row = guardCommandRow({ probe: (request) => { seen.push(request.command); return { ok: true, reason: null, shells: [{ shell: 'cmd', ok: true, status: 0 }, { shell: 'bash', ok: true, skipped: 'bash is not installed on this machine' }] }; } });
  assert.deepEqual(seen, [toolGuardCommand()]);
  assert.equal(row.id, 'guard-command');
  assert.equal(row.name, 'command guard resolvable');
  assert.equal(row.status, 'green');
  assert.match(row.detail, /runs through cmd \(skipped: bash is not installed/);
});

test('the row is a red required row naming the failing shell when the command does not resolve', () => {
  const row = guardCommandRow({ probe: () => ({ ok: false, reason: 'bash exit 127: starci: command not found', shells: [] }) });
  assert.equal(row.status, 'red');
  assert.equal(row.required, true);
  assert.match(row.detail, /does not run: bash exit 127/);
  assert.match(row.fix, /starci runtime link/);
});

test('a probe that throws is a red required row, never an exception', () => {
  const row = guardCommandRow({ probe: () => { throw new Error('spawn blocked'); } });
  assert.equal(row.status, 'red');
  assert.equal(row.required, true);
  assert.match(row.detail, /spawn blocked/);
});
