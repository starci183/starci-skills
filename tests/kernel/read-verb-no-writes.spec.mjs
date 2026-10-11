// A read verb does not write the ledger as its caller. `starci kernel status` runs mechanical reactions (resolve a met wait, renew a
// lease, drain the Runs, sweep the autopilot); they run only for the roles that own them (the Kernel seat, the Supervisor, a
// reconciler or settler child). A person, Debug or a monitor reading it gets the projection through a read-only connection, and a
// read verb that tries to write fails with read-verb-write (scripts/kernel/read-only-ledger.mjs, caller-admission.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { guardedRun, openVerbLedger } from '../../scripts/kernel/caller-admission.mjs';
import { reactionOwner, readOnlyLedger } from '../../scripts/kernel/read-only-ledger.mjs';
import { git, statusWorld } from '../helpers/kernel-status-world.mjs';
import { withLedger } from '../helpers/ledger-fixture.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const VERBS_DIR = path.join(ROOT, 'scripts', 'kernel', 'verbs');
const MARKERS = ['STARCI_ACTOR', 'STARCI_API_CHILD', 'STARCI_CALLER'];

// The arguments each read verb is run with; a verb that declares `reads: true` and has no row here fails the spec until it has one.
const READ_VERB_ARGS = (world) => ({
  status: ['--workflow', world.wf],
  survey: ['--workflow', world.wf], usage: ['--workflow', world.wf, '--legs'], observe: ['--job', 'job-d1'], logs: ['--workflow', world.wf],
  questions: ['--workflow', world.wf], messages: ['--workflow', world.wf], hierarchy: ['--workflow', world.wf], artifacts: ['--workflow', world.wf],
  coverage: ['--workflow', world.wf], peers: ['--workflow', world.wf], foundations: [], extensions: [], decisions: ['--workflow', world.wf, '--list'],
  inbox: ['--workflow', world.wf],
});
// The read-looking verbs that write when a flag asks for it: with the flag the ledger opens writable, without it the verb reads.
// A verb the world cannot satisfy refuses with its own code; the refusal still leaves the ledger untouched.
const REFUSES = { coverage: 'handover-proof-unjudged' };
const WRITING_FLAGS = { inbox: ['ack'], decisions: ['open', 'claim', 'resolve', 'escalate'] };
const READ_LOOKING = ['status', 'survey', 'usage', 'observe', 'logs', 'questions', 'messages', 'hierarchy', 'artifacts', 'coverage', 'peers', 'foundations', 'extensions', 'decisions', 'inbox'];

const readVerbs = async () => {
  const found = [];
  for (const file of fs.readdirSync(VERBS_DIR).filter((name) => name.endsWith('.mjs'))) {
    const spec = (await import(pathToFileURL(path.join(VERBS_DIR, file)).href)).default;
    if (spec?.reads === true) found.push(spec);
  }
  return found;
};

// Every write to any table of the ledger lands in zz_probe, whichever connection makes it.
function traceWrites(world) {
  world.seed((ledger) => {
    const tables = ledger.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((row) => row.name);
    ledger.db.exec('CREATE TABLE zz_probe(tbl TEXT, op TEXT)');
    for (const table of tables) {
      for (const op of ['INSERT', 'UPDATE', 'DELETE']) {
        try { ledger.db.exec(`CREATE TRIGGER zz_${table}_${op} AFTER ${op} ON "${table}" BEGIN INSERT INTO zz_probe VALUES('${table}','${op}'); END`); } catch { /* a virtual table has no trigger */ }
      }
    }
  });
}
const written = (world) => world.seed((ledger) => ledger.db.prepare('SELECT tbl, op FROM zz_probe ORDER BY rowid').all().map((row) => `${row.op} ${row.tbl}`));
const openIncidents = (world) => world.seed((ledger) => ledger.db.prepare("SELECT count(*) AS n FROM incidents WHERE status='open'").get().n);

// A world whose two owner gates wait on a commit that has landed: a reaction is owed, and its owner resolves both.
function reactiveWorld(t) {
  const world = statusWorld(t);
  git(world.other, 'add', '-A');
  git(world.other, 'commit', '-qm', 'the awaited file lands');
  traceWrites(world);
  return world;
}

function readAs(world, actor, file = 'scripts/kernel/cli.mjs', args = null) {
  const env = { ...world.baseEnv };
  for (const name of MARKERS) delete env[name];
  if (actor) env.STARCI_ACTOR = actor;
  const argv = args ?? ['status', '--workflow', world.wf];
  const run = spawnSync(process.execPath, [path.join(ROOT, file), ...argv, '--repo', world.repo, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env });
  return { run, out: (() => { try { return JSON.parse(run.stdout); } catch { return null; } })() };
}

test('every kernel verb that declares reads: true is run here against a ledger that records its writes', async (t) => {
  const verbs = await readVerbs();
  assert.deepEqual(READ_LOOKING.filter((name) => !verbs.some((spec) => spec.verb === name)), [], 'each read-looking verb declares reads: true');
  const world = reactiveWorld(t);
  const rows = READ_VERB_ARGS(world);
  for (const spec of verbs) {
    assert.ok(rows[spec.verb], `${spec.verb} declares reads: true and needs a row in READ_VERB_ARGS`);
    const { run, out } = readAs(world, null, 'scripts/kernel/cli.mjs', [spec.verb, ...rows[spec.verb]]);
    if (REFUSES[spec.verb]) assert.match(run.stdout + run.stderr, new RegExp(REFUSES[spec.verb]), spec.verb);
    else {
      assert.equal(run.status, 0, `${spec.verb}: ${run.stderr}${run.stdout}`);
      assert.equal(out.ok, true, spec.verb);
    }
    assert.deepEqual(written(world), [], `${spec.verb} run by a person wrote the ledger`);
  }
});

test('status read by a person leaves the owed reaction to its owner: nothing is written and the gates stay open', (t) => {
  const world = reactiveWorld(t);
  const { run, out } = readAs(world, null);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(out.readOnly, true);
  assert.deepEqual(written(world), []);
  assert.equal(openIncidents(world), 2);
  assert.ok(out.gates?.length || out.frontier, 'the projection still reports');
});

test('status read by Debug, a monitor or an op is read-only too', (t) => {
  const world = reactiveWorld(t);
  for (const actor of ['debug-digest', 'core-watch', 'some-op']) {
    const { run, out } = readAs(world, actor);
    assert.equal(run.status, 0, `${actor}: ${run.stderr}`);
    assert.equal(out.readOnly, true, actor);
  }
  assert.deepEqual(written(world), []);
  assert.equal(openIncidents(world), 2);
});

test('the Debug digest\'s watchdog probe writes nothing either', (t) => {
  const world = reactiveWorld(t);
  const { run } = readAs(world, 'debug-digest', 'scripts/kernel/kernel-watchdog.mjs', ['--workflow', world.wf, '--once']);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.deepEqual(written(world), []);
  assert.equal(openIncidents(world), 2);
});

test('status called by a reconciler child runs the reaction it owns: the met gates are resolved by the runtime', (t) => {
  const world = reactiveWorld(t);
  const { run, out } = readAs(world, 'reconciler/job');
  assert.equal(run.status, 0, run.stderr);
  assert.equal(out.readOnly, undefined);
  assert.ok(written(world).includes('UPDATE incidents'), `the reaction wrote: ${written(world).join(', ')}`);
  assert.equal(openIncidents(world), 0);
});

test('who owns the reactions: the Kernel seat, the Supervisor, the reconciler, the settler and an api child; nobody else', () => {
  const env = (extra = {}) => extra;
  assert.equal(reactionOwner({ role: 'kernel' }, env()), true);
  assert.equal(reactionOwner({ role: 'supervisor' }, env()), true);
  assert.equal(reactionOwner({ role: 'owner' }, env({ STARCI_ACTOR: 'reconciler/host' })), true);
  assert.equal(reactionOwner({ role: 'owner' }, env({ STARCI_ACTOR: 'supervisor' })), true);
  assert.equal(reactionOwner({ role: 'owner' }, env({ STARCI_CALLER: 'runtime-settler' })), true);
  assert.equal(reactionOwner({ role: 'owner' }, env({ STARCI_API_CHILD: '1' })), true);
  assert.equal(reactionOwner({ role: 'owner' }, env()), false);
  assert.equal(reactionOwner({ role: 'owner' }, env({ STARCI_ACTOR: 'debug-digest' })), false);
  assert.equal(reactionOwner({ role: 'op' }, env()), false);
});

test('a write through a read-only ledger throws read-verb-write and is counted, and the call fails even when the verb swallows it', (t) => withLedger(t, async ({ ledger, ledgerFile }) => {
  ledger.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const reader = readOnlyLedger(ledgerFile);
  try {
    assert.equal(reader.readOnly, true);
    assert.equal(typeof reader.db.prepare('SELECT 1 AS one').get().one, 'number', 'a read goes through');
    const attempts = [
      () => reader.transaction(() => 1), () => reader.appendEvent({}), () => reader.enqueueJob({}), () => reader.ensureWorkflow({}), () => reader.write.idempotent({}),
      () => reader.db.prepare("UPDATE meta SET value='x' WHERE key='none'"), () => reader.db.exec('DELETE FROM events'),
    ];
    for (const attempt of attempts) assert.throws(attempt, { code: 'read-verb-write' });
    assert.equal(reader.attempts.length, attempts.length);
    await assert.rejects(guardedRun(reader, async () => { try { reader.transaction(() => 1); } catch { /* the verb swallows it */ } }), { code: 'read-verb-write' });
    const clean = readOnlyLedger(ledgerFile);
    assert.equal(await guardedRun(clean, async () => 'read'), 'read');
    clean.close();
  } finally { reader.close(); }
}));

test('a verb that is not a read verb gets the writable ledger, and a read verb that does not react never does', () => {
  const opened = [];
  const openWritable = (file) => { opened.push(`writable ${file}`); return { close() {} }; };
  const reader = { readOnly: true, db: {}, path: 'p', close() { opened.push('closed reader'); } };
  const openReadOnly = (file) => { opened.push(`reader ${file}`); return reader; };
  assert.equal(openVerbLedger({ verb: 'enqueue' }, 'f', { openWritable, openReadOnly }).close !== undefined, true);
  assert.deepEqual(opened, ['writable f']);
  opened.length = 0;
  assert.equal(openVerbLedger({ verb: 'survey', reads: true }, 'f', { openWritable, openReadOnly }), reader);
  assert.deepEqual(opened, ['reader f']);
  opened.length = 0;
  const reacting = { verb: 'status', reads: true, reacts: true };
  assert.equal(openVerbLedger(reacting, 'f', { openWritable, openReadOnly, resolve: () => ({ role: 'owner' }), env: {} }), reader);
  assert.deepEqual(opened, ['reader f']);
  opened.length = 0;
  openVerbLedger(reacting, 'f', { openWritable, openReadOnly, resolve: () => ({ role: 'kernel' }), env: {} });
  assert.deepEqual(opened, ['reader f', 'closed reader', 'writable f']);
});

test('a read-looking verb opens the ledger writable only when a flag that writes is given', () => {
  const opened = [];
  const openWritable = (file) => { opened.push('writable'); return { close() {} }; };
  const reader = { readOnly: true, db: {}, path: 'p', close() {} };
  const openReadOnly = () => { opened.push('reader'); return reader; };
  for (const [verb, flags] of Object.entries(WRITING_FLAGS)) {
    const spec = { verb, reads: true, writesWith: flags };
    for (const flag of flags) {
      opened.length = 0;
      openVerbLedger(spec, 'f', { openWritable, openReadOnly, args: { [flag]: 'x' } });
      assert.deepEqual(opened, ['writable'], `${verb} --${flag}`);
    }
    opened.length = 0;
    assert.equal(openVerbLedger(spec, 'f', { openWritable, openReadOnly, args: {} }), reader);
    assert.deepEqual(opened, ['reader'], `${verb} without its writing flags`);
  }
});

test('the verbs whose writing flags the spec names are the ones whose source declares them', async () => {
  const verbs = await readVerbs();
  for (const [name, flags] of Object.entries(WRITING_FLAGS)) assert.deepEqual(verbs.find((spec) => spec.verb === name).writesWith, flags, name);
});
