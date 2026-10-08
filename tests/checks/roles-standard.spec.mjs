import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkRolesContract, standardTable, writeRoleBlocks } from '../../scripts/checks/check-roles-contract.mjs';
import { renderStandingTable, roleStandings, standingMessages } from '../../scripts/machine/roles-standard.mjs';
import { renderRolesTable, tableOf, withRolesTable } from '../../scripts/machine/roles-table.mjs';
import { rolesContract } from '../../scripts/machine/roles-contract.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';

// The role standard (roles.yaml `standard:`): every role block declares the same set of things and the runtime holds what they
// name. A missing requirement is red unless the role block carries a dated `pending:` entry that names the lane building it.

const standing = (doc, id) => roleStandings(doc, skillRoot).find((one) => one.id === id);
const withRole = (id, change) => {
  const doc = structuredClone(rolesContract(skillRoot));
  change(doc.roles.find((role) => role.id === id));
  return doc;
};
const messagesOf = (doc) => standingMessages(roleStandings(doc, skillRoot));

test('the shipped contract: the Critic meets every requirement and every gap of another role is pending with its lane and a date', () => {
  const doc = rolesContract(skillRoot);
  assert.deepEqual(doc.standard.roles, ['op', 'critic', 'kernel', 'supervisor', 'debug']);
  const standings = roleStandings(doc, skillRoot);
  assert.deepEqual(Object.values(standing(doc, 'critic').cells), Array(7).fill('present'));
  assert.deepEqual(standingMessages(standings), [], 'no requirement is missing and no pending entry is unsound');
  const pending = standings.flatMap((one) => Object.entries(one.cells).filter(([, state]) => state === 'pending').map(([requirement]) => `${one.id}:${requirement}`));
  assert.ok(pending.length > 0, 'the gaps of the lanes still running are visible');
  for (const role of doc.roles.filter((one) => one.pending)) {
    for (const entry of role.pending) {
      assert.match(entry.since, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(entry.lane, `${role.id} names the lane that builds ${entry.requirements}`);
    }
  }
  assert.deepEqual(checkRolesContract().map((finding) => finding.message), []);
});

test('the check prints the role x requirement table, with the lane of every pending cell', () => {
  const table = standardTable();
  const lines = table.split('\n');
  assert.match(lines[0], /^Role\s+fields\s+happy-errors\s+bug-surface\s+prompt-block\s+guard-binding\s+budget\s+chain$/);
  assert.equal(lines.length, 2 + 5, 'a header, a rule and one row per role');
  assert.match(lines.find((line) => line.startsWith('Critic')), /^Critic\s+present(\s+present){6}$/);
  assert.match(lines.find((line) => line.startsWith('Kernel')), /pending \(f3\)/);
  assert.match(lines.find((line) => line.startsWith('Debug')), /pending \(f4\)/);
  const out = spawnSync(process.execPath, [path.join(skillRoot, 'scripts', 'checks', 'check-roles-contract.mjs')], { encoding: 'utf8', env: { ...process.env, STARCI_RUNTIME: skillRoot } });
  assert.equal(out.status, 0, out.stderr);
  assert.ok(out.stdout.includes(table), 'the check prints the table and then its verdict');
  assert.match(out.stdout, /OK: every role surface matches the roles contract\./);
});

test('red: a requirement a role lacks, without a pending entry, is a finding that names the role and the requirement', () => {
  const messages = messagesOf(withRole('critic', (role) => { delete role.happyErrors; delete role.guard; }));
  assert.equal(messages.length, 2);
  assert.match(messages[0], /role critic lacks the standard requirement happy-errors: declares no happyErrors/);
  assert.match(messages[1], /role critic lacks the standard requirement guard-binding/);
  assert.match(messages[0], /mark it pending with the lane that owns it/);
  const noField = standing(withRole('op', (role) => { delete role.measure; }), 'op');
  assert.match(noField.problems.fields, /lacks measure/);
  assert.equal(noField.cells.fields, 'missing');
});

test('each requirement is verified against the runtime, not only declared', () => {
  const state = (id, change, requirement) => standing(withRole(id, change), id).cells[requirement];
  assert.equal(state('critic', (role) => { role.happyErrors[0].row = 'no-such-row'; }, 'happy-errors'), 'missing', 'a happy error names a row of the incident policy');
  assert.equal(state('critic', (role) => { role.happyErrors = [{ id: 'x', row: 'critic-unavailable' }]; }, 'happy-errors'), 'missing', 'a happy error says what it is');
  assert.equal(state('critic', (role) => { role.bugSurface[0].detectedBy = 'scripts/no/such-file.mjs'; }, 'bug-surface'), 'missing', 'a bug names a signal that an existing file reads');
  assert.equal(state('critic', (role) => { role.guard = { role: 'nobody' }; }, 'guard-binding'), 'missing', 'a guard role is a role of the command policy');
  assert.equal(state('critic', (role) => { delete role.guard; role.noSeat = true; }, 'guard-binding'), 'present', 'a role with no seat says so');
  assert.equal(state('critic', (role) => { delete role.tokenBudget; }, 'budget'), 'missing');
  assert.equal(state('critic', (role) => { delete role.tokenBudget; role.noBudget = 'the Critic is bounded by its wall time only'; }, 'budget'), 'present');
  assert.equal(state('critic', (role) => { delete role.tokenBudget; role.noBudget = 'none'; }, 'budget'), 'missing', 'a reason is a sentence');
  assert.equal(state('critic', (role) => { role.surfaces = role.surfaces.filter((surface) => surface.mode !== 'block'); }, 'prompt-block'), 'missing');
  const doc = rolesContract(skillRoot);
  doc.chain.reports = doc.chain.reports.filter((id) => id !== 'kernel');
  doc.chain.besides = {};
  assert.equal(roleStandings(doc, skillRoot).find((one) => one.id === 'kernel').cells.chain, 'missing', 'a role outside the reporting chain');
});

test('pending: a gap with a dated entry naming its lane is visible and not red; an unsound entry is red', () => {
  const doc = withRole('critic', (role) => {
    delete role.happyErrors;
    role.pending = [{ requirements: ['happy-errors'], lane: 'f9', since: '2026-10-08' }];
  });
  assert.equal(standing(doc, 'critic').cells['happy-errors'], 'pending');
  assert.deepEqual(messagesOf(doc), []);
  assert.match(renderStandingTable(doc, roleStandings(doc, skillRoot)), /Critic\s+present\s+pending \(f9\)/);

  const stale = withRole('critic', (role) => { role.pending = [{ requirements: ['budget'], lane: 'f9', since: '2026-10-08' }]; });
  assert.match(messagesOf(stale)[0], /role critic: pending names budget, which the role already meets: remove the entry/);
  const undated = withRole('op', (role) => { role.pending[0].since = 'soon'; });
  assert.match(messagesOf(undated).join('\n'), /role op: pending entry .* names no lane or no ISO date/);
  const nameless = withRole('op', (role) => { delete role.pending[0].lane; });
  assert.match(messagesOf(nameless).join('\n'), /names no lane or no ISO date/);
  const unknown = withRole('op', (role) => { role.pending.push({ requirements: ['telepathy'], lane: 'f6', since: '2026-10-08' }); });
  assert.match(messagesOf(unknown).join('\n'), /unknown requirement telepathy/);
});

test('green: a role that builds its requirement and drops the pending entry is clean', () => {
  const doc = withRole('kernel', (role) => {
    role.guard = { role: 'lead' };
    role.tokenBudget = { status: 'provisional', source: 'estimate', perAttempt: { default: 1000 }, onExceed: 'the Supervisor reads it' };
    role.happyErrors = [{ id: 'op-question', row: 'ask-worker-question', what: 'an Op asks a question' }];
    role.bugSurface = [{ bug: 'the Kernel hangs', signal: 'SLA SEAT_VACANT', detectedBy: 'scripts/checks/check-roles-contract.mjs' }];
    delete role.pending;
  });
  assert.deepEqual(Object.values(standing(doc, 'kernel').cells), Array(7).fill('present'));
  assert.deepEqual(messagesOf(doc), []);
});

test('the owner table is generated from the contract: five roles by scope, function, happy errors and what each does on a bug', () => {
  const doc = rolesContract(skillRoot);
  const table = renderRolesTable(doc);
  const lines = table.split('\n');
  assert.equal(lines[0], '| Role | Scope | Function | Happy errors it handles | On a bug |');
  assert.equal(lines.length, 2 + 5);
  assert.deepEqual(lines.slice(2).map((line) => line.split(' | ')[0].replace('| ', '')), ['Op', 'Critic', 'Kernel', 'Supervisor', 'Debug']);
  const critic = lines.find((line) => line.startsWith('| Critic'));
  for (const error of doc.roles.find((role) => role.id === 'critic').happyErrors) assert.ok(critic.includes(error.id), error.id);
  assert.ok(critic.includes(doc.standard.onBug.chain));
  assert.ok(lines.find((line) => line.startsWith('| Debug')).includes(doc.standard.onBug.debug));
  assert.match(lines.find((line) => line.startsWith('| Kernel')), /pending, lane f3/, 'a role whose lane has not landed says so instead of an empty cell');
  assert.ok(!table.split('\n').slice(2).some((line) => line.split(' | ').length !== 5), 'no cell breaks the table');
  const out = spawnSync(process.execPath, [path.join(skillRoot, 'scripts', 'checks', 'check-roles-contract.mjs'), '--table'], { encoding: 'utf8', env: { ...process.env, STARCI_RUNTIME: skillRoot } });
  assert.equal(out.stdout.trimEnd(), table, '-- --table prints exactly the generated table');
});

test('the table in docs/workflow-kernel.md is the generated one; --write refreshes it and a stale copy is drift', (t) => {
  const doc = rolesContract(skillRoot);
  const text = fs.readFileSync(path.join(skillRoot, 'docs', 'workflow-kernel.md'), 'utf8');
  assert.equal(tableOf(text), renderRolesTable(doc));
  assert.throws(() => withRolesTable('no markers here', doc), /lacks <!-- roles:table:begin -->/);
  assert.equal(tableOf('nothing'), null);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-roles-table-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = ['modules/kernel/roles.yaml', 'modules/kernel/op-incident-policy.yaml', 'modules/kernel/command-policy.yaml', 'docs/workflow-kernel.md', ...doc.roles.flatMap((role) => role.surfaces.map((surface) => surface.file)),
    ...doc.roles.flatMap((role) => (role.bugSurface ?? []).map((entry) => entry.detectedBy))];
  for (const file of new Set(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(path.join(skillRoot, file), path.join(root, file));
  }
  assert.deepEqual(checkRolesContract(root), []);
  const doc2 = path.join(root, 'docs', 'workflow-kernel.md');
  fs.writeFileSync(doc2, fs.readFileSync(doc2, 'utf8').replace('| Op |', '| Operator |'));
  const findings = checkRolesContract(root);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /docs\/workflow-kernel\.md carries a roles table that differs from the contract/);
  writeRoleBlocks(root);
  assert.deepEqual(checkRolesContract(root), []);
  fs.writeFileSync(doc2, fs.readFileSync(doc2, 'utf8').replace('<!-- roles:table:begin -->', ''));
  assert.match(checkRolesContract(root)[0].message, /lacks the generated roles table markers/);
});
