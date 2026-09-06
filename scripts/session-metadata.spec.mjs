import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSession, confirmSession, answerFor, cleanupFixtureOwners } from './v23-test-fixture.mjs';
import { discoverSession } from './session-open.mjs';
import { validateSession } from './validate-session.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(await readFile(path.join(root, 'templates/step/state.schema.json'), 'utf8'));
const missionSchema = schema.properties.mission;
const authoritySchema = missionSchema.properties.confirmation.properties.authority;
const statementLimit = authoritySchema.properties.statement.maxLength;
const excerptLimit = authoritySchema.properties.coverage.additionalProperties.maxLength;
const evidenceLimit = missionSchema.properties.doneWhen.items.properties.evidence.maxLength;

async function fixture(t, evidence = 'Readiness has reviewable evidence.') {
  const owner = await mkdtemp(path.join(os.tmpdir(), 'starci-metadata-'));
  t.after(async () => {
    cleanupFixtureOwners(owner);
    const resolved = path.resolve(owner);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('starci-metadata-'));
    await rm(resolved, { recursive: true, force: true });
  });
  const sessions = path.join(owner, '.worktrees/sessions');
  const input = {
    project: 'metadata',
    hostBinding: { kind: 'codex-task', hostId: path.basename(owner), worktree: owner, sourcePromptRef: 'user:opening' },
    mission: {
      language: 'en', goal: 'Inspect declared readiness.', target: 'Environment',
      includes: ['Read-only readiness'], excludes: [], outputs: ['Readiness report'],
      doneWhen: [{ evidence, producedBy: 'environment.preflight' }],
      verification: 'Read the report.', sourceRef: 'user:opening'
    }
  };
  return { owner, sessions, input, open: () => openSession(sessions, input) };
}

test('long authorized metadata remains byte-exact through confirmation and ledger validation', async t => {
  const f = await fixture(t, 'e'.repeat(251));
  const opened = await f.open();
  const file = path.join(opened.session, 'state.json');
  const draft = JSON.parse(await readFile(file, 'utf8'));
  const authority = answerFor(draft.mission, 'user:approved');
  authority.statement = 'a'.repeat(8015);
  for (const key of Object.keys(authority.coverage)) authority.coverage[key] = authority.statement;
  await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:approved', authority });
  const before = await readFile(file);
  const state = JSON.parse(before);
  assert.equal(state.mission.version, 1);
  assert.deepEqual(state.mission.confirmation.authority, authority);
  assert.equal(state.mission.doneWhen[0].evidence, f.input.mission.doneWhen[0].evidence);
  assert.equal(Object.keys(state.missionSnapshots).length, 1);
  const history = path.join(opened.session, 'runtime/history/missions');
  const names = await readdir(history);
  const snapshots = await Promise.all(names.map(name => readFile(path.join(history, name))));
  assert.deepEqual((await validateSession(root, opened.session)).errors, []);
  assert.deepEqual(await readFile(file), before);
  assert.deepEqual(await Promise.all(names.map(name => readFile(path.join(history, name)))), snapshots);
});

test('metadata at the declared schema boundaries is admitted without truncation', async t => {
  const f = await fixture(t, 'e'.repeat(evidenceLimit));
  const opened = await f.open();
  const file = path.join(opened.session, 'state.json');
  const draft = JSON.parse(await readFile(file, 'utf8'));
  const authority = answerFor(draft.mission, 'user:boundary');
  authority.statement = 'a'.repeat(statementLimit);
  for (const key of Object.keys(authority.coverage)) authority.coverage[key] = authority.statement.slice(0, excerptLimit);
  await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:boundary', authority });
  const state = JSON.parse(await readFile(file, 'utf8'));
  assert.deepEqual(state.mission.confirmation.authority, authority);
  assert.equal(state.mission.doneWhen[0].evidence.length, evidenceLimit);
  assert.deepEqual((await validateSession(root, opened.session)).errors, []);
});

test('invalid authority is rejected before confirmation or immutable history is written', async t => {
  const f = await fixture(t);
  const opened = await f.open();
  const file = path.join(opened.session, 'state.json');
  const before = await readFile(file);
  const draft = JSON.parse(before);
  const tooLong = answerFor(draft.mission, 'user:approved');
  tooLong.statement += 'a'.repeat(statementLimit + 1);
  await assert.rejects(confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:approved', authority: tooLong }), /statement.*(too long|contract limit)/);
  assert.deepEqual(await readFile(file), before);
  assert.equal(existsSync(path.join(opened.session, 'runtime/history/missions')), false);

  const badExcerpt = answerFor(draft.mission, 'user:approved');
  badExcerpt.statement = 'x'.repeat(Math.max(statementLimit, excerptLimit) + 1);
  for (const key of Object.keys(badExcerpt.coverage)) badExcerpt.coverage[key] = badExcerpt.statement;
  await assert.rejects(confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:approved', authority: badExcerpt }), /coverage.impact.*(too long|contract limit)/);
  assert.deepEqual(await readFile(file), before);
  assert.equal(existsSync(path.join(opened.session, 'runtime/history/missions')), false);
});

test('opening an invalid draft cannot leave a nonconforming session behind', async t => {
  const f = await fixture(t, 'e'.repeat(evidenceLimit + 1));
  await assert.rejects(f.open(), /doneWhen\[0\].evidence.*too long/);
  assert.deepEqual(existsSync(f.sessions) ? await readdir(f.sessions) : [], []);
});

test('discovery and correction reject invalid metadata without changing retained state or history', async t => {
  const f = await fixture(t);
  const opened = await f.open();
  const file = path.join(opened.session, 'state.json');
  let before = await readFile(file);
  let state = JSON.parse(before);
  const bad = structuredClone(state.mission);
  bad.doneWhen[0].evidence = 'e'.repeat(evidenceLimit + 1);
  await assert.rejects(discoverSession(opened.session, bad), /doneWhen\[0\].evidence.*too long/);
  assert.deepEqual(await readFile(file), before);
  await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:approved' });
  before = await readFile(file);
  state = JSON.parse(before);
  const history = path.join(opened.session, 'runtime/history/missions');
  const names = await readdir(history);
  const snapshots = await Promise.all(names.map(name => readFile(path.join(history, name))));
  await assert.rejects(confirmSession(opened.session, { selected: 'corrected', selectedBy: 'user', sourceRef: 'user:corrected', mission: { ...state.mission, doneWhen: bad.doneWhen } }), /doneWhen\[0\].evidence.*too long/);
  assert.deepEqual(await readFile(file), before);
  assert.deepEqual(await readdir(history), names);
  assert.deepEqual(await Promise.all(names.map(name => readFile(path.join(history, name)))), snapshots);
});

test('reusing or changing topology refuses a nonconforming retained session', async t => {
  const f = await fixture(t);
  const opened = await f.open();
  const file = path.join(opened.session, 'state.json');
  const state = JSON.parse(await readFile(file, 'utf8'));
  state.mission.doneWhen[0].evidence = 'e'.repeat(evidenceLimit + 1);
  await writeFile(file, JSON.stringify(state));
  const before = await readFile(file);
  await assert.rejects(f.open(), /doneWhen\[0\].evidence.*too long/);
  await assert.rejects(openSession(f.sessions, { ...f.input, topology: { mode: 'coordinated' } }), /doneWhen\[0\].evidence.*too long/);
  assert.deepEqual(await readFile(file), before);
  assert.equal(existsSync(path.join(opened.session, 'runtime/history/missions')), false);
});

test('rejection validates the complete candidate and leaves invalid retained state unchanged', async t => {
  const f = await fixture(t);
  const opened = await f.open();
  const file = path.join(opened.session, 'state.json');
  const state = JSON.parse(await readFile(file, 'utf8'));
  state.budget.maxSteps = 'invalid';
  await writeFile(file, JSON.stringify(state));
  const before = await readFile(file);
  await assert.rejects(confirmSession(opened.session, { selected: 'rejected', selectedBy: 'user', sourceRef: 'user:rejected' }), /budget.maxSteps/);
  assert.deepEqual(await readFile(file), before);
  assert.equal(existsSync(path.join(opened.session, 'runtime/history/missions')), false);
});

test('correction refuses to archive invalid prior metadata even when the replacement is valid', async t => {
  const f = await fixture(t);
  const opened = await f.open();
  const file = path.join(opened.session, 'state.json');
  await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:approved' });
  const state = JSON.parse(await readFile(file, 'utf8'));
  const corrected = structuredClone(state.mission);
  state.mission.doneWhen[0].evidence = 'e'.repeat(evidenceLimit + 1);
  await writeFile(file, JSON.stringify(state));
  const before = await readFile(file);
  const history = path.join(opened.session, 'runtime/history/missions');
  const names = await readdir(history);
  const snapshots = await Promise.all(names.map(name => readFile(path.join(history, name))));
  await assert.rejects(confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:approved' }), /doneWhen\[0\].evidence.*too long/);
  await assert.rejects(confirmSession(opened.session, { selected: 'corrected', selectedBy: 'user', sourceRef: 'user:correction', mission: corrected }), /doneWhen\[0\].evidence.*too long/);
  assert.deepEqual(await readFile(file), before);
  assert.deepEqual(await readdir(history), names);
  assert.deepEqual(await Promise.all(names.map(name => readFile(path.join(history, name)))), snapshots);
});
