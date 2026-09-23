import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectLedger, ledgerFileFor, openLedger } from '../engine/ledger-db.mjs';
import { parseYaml } from '../engine/yaml.mjs';
import { resolveOpParams } from '../scripts/route/dispatch-op.mjs';

// The tunable's road: the brief declares it, the goal leg carries what the owner
// chose, `api enqueue --params` carries what the kernel chose, and the dispatch
// packet delivers the merged values. No step of it reads a number out of prose.
const ROOT = path.resolve(import.meta.dirname, '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const OPS = path.join(ROOT, 'modules', 'ops', 'ops');

const runApi = (...args) => spawnSync(process.execPath, [API, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 });
const out = (r) => { try { return JSON.parse(r.stdout); } catch { return null; } };
const json = (v) => JSON.stringify(v ?? null);

const fixture = (t) => {
  const dirs = [];
  t.after(() => { for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  return { repo() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-params-')); dirs.push(dir); return dir; } };
};
const seed = (repo, fn) => { const ledger = openLedger({ file: ledgerFileFor(repo) }); try { fn(ledger); } finally { ledger.close(); } };
const read = (repo, fn) => { const ledger = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(ledger); } finally { ledger.close(); } };

/** A workflow whose goal carries an opChain whose legs may carry params — the
 *  shape scripts/goal/define-goal.mjs --params persists. */
const seedGoal = (repo, workflowId, legs = []) => {
  seed(repo, (ledger) => {
    const at = Date.now();
    ledger.ensureWorkflow({ workflowId, title: 'params road' });
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(workflowId, 0, 'paramsgoal', '# goal', json({ derivedFrom: 'params-test', opChain: { legs } }), at);
  });
};

const briefOf = (op) => parseYaml(fs.readFileSync(path.join(OPS, `${op}.yaml`), 'utf8'));

/** Any catalogued op that declares params, so this spec follows the catalog
 *  instead of pinning one op's name. */
function opWithParams(predicate = () => true) {
  for (const file of fs.readdirSync(OPS).filter((f) => f.endsWith('.yaml')).sort()) {
    const doc = parseYaml(fs.readFileSync(path.join(OPS, file), 'utf8'));
    const entries = Object.entries(doc?.params ?? {});
    const hit = entries.find(([name, def]) => predicate(def, name));
    if (hit) return { op: doc.id, doc, name: hit[0], def: hit[1] };
  }
  return null;
}

test('the catalog declares its tunables as params, not as numbers in prose', () => {
  const owned = opWithParams((def) => def.setBy === 'owner');
  const kernelSet = opWithParams((def) => def.setBy === 'kernel');
  assert.ok(owned, 'no op declares a setBy: owner param');
  assert.ok(kernelSet, 'no op declares a setBy: kernel param');
  for (const [name, def] of Object.entries(owned.doc.params)) {
    assert.ok(Object.hasOwn(def, 'default'), `${owned.op}.${name} has no default`);
    assert.ok(def.doc?.en, `${owned.op}.${name} has no doc`);
  }
});

test('resolveOpParams answers with the defaults when nobody set anything', () => {
  const { doc } = opWithParams();
  const resolved = resolveOpParams(doc, {});
  assert.equal(resolved.ok, true);
  for (const [name, def] of Object.entries(doc.params)) assert.equal(resolved.params[name], def.default);
  assert.deepEqual(resolved.overrides, {});
});

test('resolveOpParams refuses an undeclared name, a bad type and an out-of-range value', () => {
  const bounded = opWithParams((def) => def.type === 'integer' && def.max !== undefined);
  assert.ok(bounded, 'no op declares a bounded integer param');
  const { doc, name, def } = bounded;

  const stranger = resolveOpParams(doc, { flag: { thisIsNotAParam: 1 } });
  assert.equal(stranger.ok, false);
  assert.equal(stranger.reason, 'params-invalid');
  assert.match(stranger.detail, /does not declare/);

  // The value's source has to be the one the brief allows, or the setter
  // refusal fires before the range one.
  const from = (value) => (def.setBy === 'owner'
    ? { leg: { [name]: value }, flag: { [name]: value } }
    : { flag: { [name]: value } });

  const wrongType = resolveOpParams(doc, from('two'));
  assert.equal(wrongType.ok, false);
  assert.equal(wrongType.reason, 'params-invalid');

  const tooBig = resolveOpParams(doc, from(def.max + 1));
  assert.equal(tooBig.ok, false);
  assert.match(tooBig.detail, /above its maximum/);
});

test('an owner param comes from the goal leg; a kernel param never does', () => {
  const owned = opWithParams((def) => def.setBy === 'owner');
  const relayed = resolveOpParams(owned.doc, { leg: { [owned.name]: owned.def.default }, flag: { [owned.name]: owned.def.default } });
  assert.equal(relayed.ok, true, relayed.detail);

  const unbacked = resolveOpParams(owned.doc, { flag: { [owned.name]: owned.def.default } });
  assert.equal(unbacked.ok, false);
  assert.match(unbacked.detail, /set by the owner/);

  const kernelSet = opWithParams((def) => def.setBy === 'kernel');
  const smuggled = resolveOpParams(kernelSet.doc, { leg: { [kernelSet.name]: kernelSet.def.default } });
  assert.equal(smuggled.ok, false);
  assert.match(smuggled.detail, /set by the kernel/);
});

test('enqueue refuses an out-of-range value with params-invalid and writes no job', (t) => {
  const bounded = opWithParams((def) => def.setBy === 'kernel' && def.type === 'integer' && def.max !== undefined);
  assert.ok(bounded, 'no op declares a bounded kernel integer param');
  const fx = fixture(t), repo = fx.repo(), wf = 'wf-params-refuse';
  seedGoal(repo, wf, [{ seq: 1, op: bounded.op }]);

  const r = runApi('enqueue', '--repo', repo, '--workflow', wf, '--op', bounded.op, '--paths', 'src/',
    '--params', JSON.stringify({ [bounded.name]: bounded.def.max + 1 }), '--json');
  assert.equal(r.status, 1, `expected a refusal, got ${r.status}: ${r.stdout}`);
  const refusal = (() => { try { return JSON.parse(r.stderr.trim().split('\n').at(-1)); } catch { return null; } })();
  assert.ok(refusal, `refusal should print JSON, got: ${r.stderr}`);
  assert.equal(refusal.ok, false);
  assert.equal(refusal.code, 'params-invalid');
  assert.equal(read(repo, (l) => l.db.prepare('SELECT COUNT(*) n FROM jobs WHERE workflow_id=?').get(wf).n), 0,
    'a refused enqueue must leave no jobs row behind');
});

test('enqueue refuses an owner param the approved goal leg does not carry', (t) => {
  const owned = opWithParams((def) => def.setBy === 'owner');
  const fx = fixture(t), repo = fx.repo(), wf = 'wf-params-owner';
  seedGoal(repo, wf, [{ seq: 1, op: owned.op }]);
  const r = runApi('enqueue', '--repo', repo, '--workflow', wf, '--op', owned.op, '--paths', 'src/',
    '--params', JSON.stringify({ [owned.name]: owned.def.default }), '--json');
  assert.equal(r.status, 1, `expected a refusal, got ${r.status}: ${r.stdout}`);
  assert.match(r.stderr, /params-invalid/);
});

test('an enqueued job stores only the overrides, and the goal leg supplies the owner value', (t) => {
  const owned = opWithParams((def) => def.setBy === 'owner' && def.type === 'integer' && def.max !== undefined);
  assert.ok(owned, 'no op declares a bounded owner integer param');
  const chosen = owned.def.max;
  const fx = fixture(t), repo = fx.repo(), wf = 'wf-params-leg';
  seedGoal(repo, wf, [{ seq: 1, op: owned.op, params: { [owned.name]: chosen } }]);

  const r = runApi('enqueue', '--repo', repo, '--workflow', wf, '--op', owned.op, '--paths', 'src/', '--json');
  assert.equal(r.status, 0, r.stderr || r.error?.message);
  assert.equal(out(r).params[owned.name], chosen);
  const payload = JSON.parse(read(repo, (l) => l.db.prepare('SELECT payload_json FROM jobs WHERE workflow_id=?').get(wf).payload_json));
  assert.equal(payload.params[owned.name], chosen, 'the job row must carry what the owner chose');
});

test('the dispatch packet carries the brief defaults with the overrides on top', (t) => {
  const owned = opWithParams((def) => def.setBy === 'owner' && def.type === 'integer' && def.max !== undefined);
  const chosen = owned.def.max;
  const fx = fixture(t), repo = fx.repo(), wf = 'wf-params-packet';
  seedGoal(repo, wf, [{ seq: 1, op: owned.op, params: { [owned.name]: chosen } }]);
  const enqueued = out(runApi('enqueue', '--repo', repo, '--workflow', wf, '--op', owned.op, '--paths', 'src/', '--json'));
  assert.ok(enqueued?.job_id, 'enqueue produced no job');

  const r = runApi('dispatch', '--repo', repo, '--job', enqueued.job_id, '--json');
  const body = out(r);
  assert.ok(body?.packet, `dispatch printed no packet: ${r.stdout}\n${r.stderr}`);
  const brief = briefOf(owned.op);
  assert.equal(body.packet.params[owned.name], chosen, 'the override must win');
  for (const [name, def] of Object.entries(brief.params)) {
    if (name === owned.name) continue;
    assert.equal(body.packet.params[name], def.default, `${name} must fall back to the brief default`);
  }
  assert.match(body.prompt, new RegExp(`params: .*${owned.name}=${chosen}`),
    'the agent prompt must state the resolved values');
});

// provision.ask must say what it asks: params.subject is required of the kernel
// at enqueue and has no default a missing question could hide behind.
test('provision.ask declares params.subject as a required kernel string', () => {
  const def = briefOf('provision.ask').params.subject;
  assert.deepEqual([def.type, def.required, def.setBy, Object.hasOwn(def, 'default')], ['string', true, 'kernel', false]);
  const refused = resolveOpParams(briefOf('provision.ask'), { enforceRequired: true });
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'params-invalid');
  assert.equal(refused.param, 'subject');
  assert.match(refused.detail, /params\.subject/);
  assert.match(refused.detail, /--params '\{"subject"/);
  const legacy = resolveOpParams(briefOf('provision.ask'), {});
  assert.equal(legacy.ok, true, 'a job enqueued before the param existed still renders a packet');
  assert.equal(Object.hasOwn(legacy.params, 'subject'), false);
});

test('enqueue refuses provision.ask without params.subject and says how to re-enqueue', (t) => {
  const fx = fixture(t), repo = fx.repo(), wf = 'wf-params-ask';
  seedGoal(repo, wf, [{ seq: 1, op: 'provision.ask' }]);
  const r = runApi('enqueue', '--repo', repo, '--workflow', wf, '--op', 'provision.ask', '--paths', '.starciwork/features/x/decision', '--json');
  assert.equal(r.status, 1, `expected a refusal, got ${r.status}: ${r.stdout}`);
  const refusal = out(r);
  assert.deepEqual([refusal?.ok, refusal?.reason, refusal?.param], [false, 'params-invalid', 'subject']);
  assert.match(refusal.detail, /re-run enqueue with --params/);
  assert.equal(read(repo, (l) => l.db.prepare('SELECT COUNT(*) n FROM jobs WHERE workflow_id=?').get(wf).n), 0);

  const subject = 'Which payment provider should checkout use: SePay or VNPAY?';
  const ok = out(runApi('enqueue', '--repo', repo, '--workflow', wf, '--op', 'provision.ask', '--paths', '.starciwork/features/x/decision',
    '--params', JSON.stringify({ subject }), '--json'));
  assert.equal(ok?.params?.subject, subject);
  const body = out(runApi('dispatch', '--repo', repo, '--job', ok.job_id, '--json'));
  assert.equal(body?.packet?.params?.subject, subject, 'the packet carries the question');
  assert.match(body.prompt, /params: .*subject="Which payment provider/, 'the op prompt shows what it asks');
});

// A StarCi Next brand.decide read only the empty bound frontend repository and
// reported no owner ruling, while the ruling ("Core grammar, brand like the
// StarCi Academy dashboard and subscriptions") sat in an incident the worker
// cannot open. The Kernel now hands the ruling and the sources it names over.
test('brand.decide takes the owner ruling and the reference sources it names from the Kernel', () => {
  const brief = parseYaml(fs.readFileSync(path.join(OPS, 'brand.decide.yaml'), 'utf8'));
  for (const name of ['ownerRulings', 'referenceSources']) {
    assert.equal(brief.params?.[name]?.setBy, 'kernel');
    assert.equal(brief.params?.[name]?.type, 'string');
  }
  const ruled = resolveOpParams(brief, { flag: { ownerRulings: 'Core grammar; identity as the Academy dashboard', referenceSources: 'D:/x/globals.css' }, enforceRequired: true });
  assert.equal(ruled.ok, true, ruled.detail);
  assert.equal(ruled.params.ownerRulings, 'Core grammar; identity as the Academy dashboard');
  assert.equal(resolveOpParams(brief, { enforceRequired: true }).ok, true, 'a brand op with no ruling to pass still enqueues');
  const reads = Object.fromEntries(brief.reads.map((r) => [r.id, r.path]));
  assert.match(reads.owner, /params\.ownerRulings/);
  assert.match(reads.sources, /params\.referenceSources/);
  assert.match(reads.grammar, /before the app is scaffolded/);
});
