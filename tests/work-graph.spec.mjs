import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { withLedger, seedWorkflow } from './_ledger-fixture.mjs';
import { validateGraph, frontierOf, diffGraphs, recolor } from '../scripts/work/work-graph-model.mjs';
import { latestVersion, liveColors, versionsOf } from '../scripts/work/work-graph-store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'scripts', 'work', 'work-graph.mjs');
const BACKFILL = path.join(ROOT, 'scripts', 'work', 'backfill-work-graph.mjs');
const WF = 'wf-auth';
const run = (script, args) => {
  const r = spawnSync(process.execPath, [script, ...args, '--json'], { encoding: 'utf8', cwd: ROOT, windowsHide: true });
  return { status: r.status, out: r.stdout.trim() ? JSON.parse(r.stdout) : null, stderr: r.stderr };
};

const node = (id, kind, fields = {}) => {
  const [domain, sliceSeg] = id.split('.');
  const slice = kind === 'task' ? `${domain}.${sliceSeg}` : id;
  return { id, domain, slice, kind, title: id, ownedPaths: [`src/${id.replaceAll('.', '/')}`], reads: [], rollbackTo: slice,
    ...(kind === 'task' ? {} : { size: { files: 3, records: 1 } }), ...fields };
};
/** AUTH: a foundation slice (user table, tokens, config) and 5 journey slices, plus the notify domain it needs mail from. */
function authGraph() {
  return {
    schema: 'starci/work-graph@1', workflow: WF,
    domains: [{ id: 'auth' }, { id: 'notify' }],
    nodes: [
      node('auth.foundation', 'foundation', { title: 'user table, tokens, config', ownedPaths: ['src/auth/foundation'] }),
      node('auth.login', 'slice', { frs: ['fr.auth.login'], reads: ['src/auth/foundation'] }),
      node('auth.register', 'slice', { frs: ['fr.auth.register'], reads: ['src/auth/foundation', 'src/notify/mail'] }),
      node('auth.forgot-password', 'slice', { frs: ['fr.auth.forgot-password'], reads: ['src/auth/foundation', 'src/notify/mail'] }),
      node('auth.session', 'slice', { frs: ['fr.auth.session'], reads: ['src/auth/login'] }),
      node('auth.oauth', 'slice', { frs: ['fr.auth.oauth'], reads: ['src/auth/foundation'] }),
      node('notify.mail', 'slice', { ownedPaths: ['src/notify/mail'] }),
    ],
    edges: [
      ...['login', 'register', 'forgot-password', 'oauth'].map((s) => ({ from: 'auth.foundation', to: `auth.${s}`, kind: 'order' })),
      { from: 'auth.login', to: 'auth.session', kind: 'data' },
      { from: 'notify.mail', to: 'auth.register', kind: 'contract' },
      { from: 'notify.mail', to: 'auth.forgot-password', kind: 'contract' },
    ],
  };
}
const AUTH_FRS = ['fr.auth.login', 'fr.auth.register', 'fr.auth.forgot-password', 'fr.auth.session', 'fr.auth.oauth'];

function writeFrs(repoRoot, frs) {
  for (const id of frs) {
    const dir = path.join(repoRoot, '.starciwork', 'features', 'auth', 'fr', id.split('.').pop());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.yaml'), `schema: work/functional-requirement@1\nid: ${id}\ntitle: ${id}\nstate: todo\n`);
  }
}
const writeCandidate = (dir, graph, name = 'candidate.json') => { const file = path.join(dir, name); fs.writeFileSync(file, JSON.stringify(graph)); return file; };
const jobs = (list) => list.map(([jobId, opId, status, paths = [], updatedAt]) => ({ jobId, opId, status, payload: { owned_paths: paths }, ...(updatedAt ? { updatedAt } : {}) }));

test('the AUTH example validates: 5 slices, a foundation first and a contract edge to notify', () => {
  const verdict = validateGraph(authGraph(), { workflowId: WF, context: { frs: AUTH_FRS } });
  assert.deepEqual(verdict.findings, []);
  const frontier = frontierOf(authGraph(), {}).map((n) => n.id);
  assert.equal(frontier[0], 'auth.foundation');
  assert.ok(frontier.includes('notify.mail'));
  assert.ok(!frontier.includes('auth.session'), 'session waits on login');
});

test('scope.define records v0; a revision that removes a slice turns its descendants red and keeps the rest', (t) => withLedger(t, ({ repoRoot, root, ledger }) => {
  writeFrs(repoRoot, AUTH_FRS);
  seedWorkflow(ledger, { id: WF, jobs: jobs([['j-scope', 'scope.define', 'running']]) });
  const v0 = run(CLI, ['propose', '--repo', repoRoot, '--job', 'j-scope', '--file', writeCandidate(root, authGraph()), '--reason', 'v0 from the request']);
  assert.equal(v0.status, 0, v0.stderr);
  assert.equal(v0.out.version, 0);
  assert.equal(v0.out.event, 'draw');

  // login and session are built, register too.
  const later = latestVersion(ledger.db, WF).createdAt + 1;
  seedWorkflow(ledger, { id: WF, jobs: jobs([
    ['j-login', 'backend.implement', 'succeeded', ['src/auth/login'], later],
    ['j-session', 'backend.implement', 'succeeded', ['src/auth/session'], later],
    ['j-register', 'backend.implement', 'succeeded', ['src/auth/register'], later],
    ['j-biz', 'business.decide', 'running'],
  ]) });
  const before = liveColors(ledger.db, latestVersion(ledger.db, WF));
  assert.equal(before['auth.session'], 'green');
  assert.equal(before['auth.register'], 'green');

  const v1graph = authGraph();
  v1graph.nodes = v1graph.nodes.filter((n) => n.id !== 'auth.login').map((n) => (n.id === 'auth.session' ? { ...n, frs: ['fr.auth.session', 'fr.auth.login'], reads: [] } : n));
  v1graph.edges = v1graph.edges.filter((e) => e.from !== 'auth.login' && e.to !== 'auth.login');
  const v1 = run(CLI, ['propose', '--repo', repoRoot, '--workflow', WF, '--job', 'j-biz', '--file', writeCandidate(root, v1graph), '--reason', 'login merged into session']);
  assert.equal(v1.status, 0, v1.stderr);
  assert.equal(v1.out.version, 1);
  assert.equal(v1.out.event, 'revise');
  assert.deepEqual(v1.out.diff.removed, ['auth.login']);
  assert.deepEqual(v1.out.diff.red, ['auth.session']);
  assert.equal(v1.out.colors['auth.session'], 'red');
  assert.equal(v1.out.colors['auth.register'], 'green', 'an untouched node keeps its colour');
  assert.equal(v1.out.colors['auth.oauth'], 'gray', 'a node with nothing done stays gray');

  const history = versionsOf(ledger.db, WF);
  assert.deepEqual(history.map((v) => [v.version, v.authorOp, v.authorJob]), [[0, 'scope.define', 'j-scope'], [1, 'business.decide', 'j-biz']]);
  assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM events WHERE workflow_id=? AND kind='work-graph-version'").get(WF).n, 2);
  const same = run(CLI, ['propose', '--repo', repoRoot, '--job', 'j-biz', '--file', writeCandidate(root, v1graph), '--reason', 'again']);
  assert.equal(same.out.unchanged, true);
  assert.equal(versionsOf(ledger.db, WF).length, 2, 'an equal graph records nothing');

  const shown = run(CLI, ['show', '--repo', repoRoot, '--workflow', WF]);
  assert.equal(shown.out.version, 1);
  assert.ok(shown.out.frontier.includes('auth.session'), 'a red node is runnable again');
}));

test('the validator refuses a candidate and nothing is recorded', (t) => withLedger(t, ({ repoRoot, root, ledger }) => {
  writeFrs(repoRoot, AUTH_FRS);
  seedWorkflow(ledger, { id: WF, jobs: jobs([['j-scope', 'scope.define', 'running']]) });
  const bad = authGraph();
  bad.nodes = bad.nodes.filter((n) => n.id !== 'auth.oauth');
  bad.nodes.find((n) => n.id === 'auth.register').ownedPaths.push('src/auth/login/shared');
  bad.edges = bad.edges.filter((e) => e.to !== 'auth.oauth');
  bad.edges.push({ from: 'auth.session', to: 'auth.login', kind: 'order' });
  bad.edges = bad.edges.filter((e) => !(e.from === 'notify.mail' && e.to === 'auth.register'));
  const r = run(CLI, ['propose', '--repo', repoRoot, '--job', 'j-scope', '--file', writeCandidate(root, bad), '--reason', 'broken']);
  assert.equal(r.status, 1);
  assert.equal(r.out.code, 'work-graph-invalid');
  const codes = new Set(r.out.findings.map((f) => f.code));
  for (const code of ['CYCLE', 'OWNED_PATH_OVERLAP', 'FR_UNCOVERED', 'CONTRACT_EDGE_MISSING']) assert.ok(codes.has(code), `${code} in ${[...codes]}`);
  assert.equal(latestVersion(ledger.db, WF), null);

  const oversized = authGraph();
  oversized.nodes.find((n) => n.id === 'auth.oauth').size = { files: 11 };
  const findings = validateGraph(oversized, { workflowId: WF, context: { frs: AUTH_FRS } }).findings;
  assert.deepEqual(findings.map((f) => f.code), ['OVERSIZED']);
  const cut = structuredClone(oversized);
  cut.nodes.push(...[1, 2, 3, 4, 5].map((i) => node(`auth.oauth.part-${i}`, 'task', { parent: 'auth.oauth', size: { files: 6 }, ownedPaths: [`src/auth/oauth/part-${i}`] })));
  assert.deepEqual(validateGraph(cut, { workflowId: WF, context: { frs: AUTH_FRS } }).findings, [], 'a cut slice is judged by its children');
}));

test('the Kernel and ops without the permission are refused; a cut stays inside its slice', (t) => withLedger(t, ({ repoRoot, root, ledger }) => {
  writeFrs(repoRoot, AUTH_FRS);
  seedWorkflow(ledger, { id: WF, jobs: jobs([['j-scope', 'scope.define', 'running'], ['j-impl', 'backend.implement', 'running'],
    ['j-biz', 'business.decide', 'running'], ['j-done', 'scope.define', 'succeeded'], ['j-cut', 'work.author', 'running']]) });
  const file = writeCandidate(root, authGraph());
  const kernel = run(CLI, ['propose', '--repo', repoRoot, '--workflow', WF, '--file', file, '--reason', 'kernel edit']);
  assert.equal(kernel.status, 1);
  assert.equal(kernel.out.code, 'graph-write-denied');
  for (const job of ['j-impl', 'j-biz', 'j-done']) {
    const r = run(CLI, ['propose', '--repo', repoRoot, '--job', job, '--file', file, '--reason', 'try']);
    assert.equal(r.out.code, 'graph-write-denied', `${job}: ${JSON.stringify(r.out)}`);
  }
  assert.equal(latestVersion(ledger.db, WF), null);
  assert.equal(run(CLI, ['propose', '--repo', repoRoot, '--job', 'j-scope', '--file', file, '--reason', 'v0']).status, 0);

  const cut = authGraph();
  cut.nodes.push(node('auth.oauth.google', 'task', { parent: 'auth.oauth', size: { files: 2 } }));
  cut.nodes.find((n) => n.id === 'auth.login').title = 'renamed outside the slice';
  cut.nodes.find((n) => n.id === 'auth.login').frs = ['fr.auth.login', 'fr.auth.extra'];
  const outside = run(CLI, ['propose', '--repo', repoRoot, '--job', 'j-cut', '--slice', 'auth.oauth', '--file', writeCandidate(root, cut, 'cut.json'), '--reason', 'cut oauth']);
  assert.equal(outside.out.code, 'work-graph-cut-outside-slice');
  cut.nodes.find((n) => n.id === 'auth.login').frs = ['fr.auth.login'];
  cut.nodes.find((n) => n.id === 'auth.login').title = 'auth.login';
  const inside = run(CLI, ['propose', '--repo', repoRoot, '--job', 'j-cut', '--slice', 'auth.oauth', '--file', writeCandidate(root, cut, 'cut.json'), '--reason', 'cut oauth']);
  assert.equal(inside.status, 0, JSON.stringify(inside.out));
  assert.equal(inside.out.event, 'cut');
  assert.deepEqual(inside.out.diff.added, ['auth.oauth.google']);
}));

test('diff and recolor: an input change reddens the node and its descendants only', () => {
  const prev = authGraph(), next = authGraph();
  next.nodes.find((n) => n.id === 'auth.login').reads = ['src/auth/foundation', 'src/auth/foundation/keys'];
  const diff = diffGraphs(prev, next);
  assert.deepEqual(diff.changed, [{ id: 'auth.login', fields: ['reads'] }]);
  const green = Object.fromEntries(prev.nodes.map((n) => [n.id, 'green']));
  const { red, colors } = recolor(green, prev, next, diff);
  assert.deepEqual(red, ['auth.login', 'auth.session']);
  assert.equal(colors['auth.register'], 'green');
});

function writeWorkTree(repoRoot) {
  const f = path.join(repoRoot, '.starciwork', 'features', 'auth');
  fs.mkdirSync(f, { recursive: true });
  const put = (rel, text) => { fs.mkdirSync(path.join(f, rel), { recursive: true }); fs.writeFileSync(path.join(f, rel, 'index.yaml'), text); };
  fs.writeFileSync(path.join(f, 'index.yaml'), `schema: work/feature@1\nid: auth\ntitle: Auth\ndescription: Auth.\nextensions:\n  work3:\n    scope:\n      request: {workflow: ${WF}, goalIdentity: g, goalRevision: 0, outcome: Auth works.}\n      nodes: []\n      deps: []\n      exclusions: []\n`);
  put('data/user', 'schema: work/data@1\nid: data.auth.user\ntitle: User\n');
  put('fr/sign-in', 'schema: work/functional-requirement@1\nid: fr.auth.sign-in\ntitle: Sign in\n');
  put('fr/register', 'schema: work/functional-requirement@1\nid: fr.auth.register\ntitle: Register\n');
  put('fr/audit', 'schema: work/functional-requirement@1\nid: fr.auth.audit\ntitle: Audit\n');
  put('journey/gain-access', 'schema: work/customer-journey@1\nid: journey.auth.gain-access\ntitle: Gain access\nrequirements: [fr.auth.sign-in]\n');
  put('journey/join', 'schema: work/customer-journey@1\nid: journey.auth.join\ntitle: Join\nrequirements: [fr.auth.register]\n');
  put('impl/app/tokens', 'schema: work/implementation@1\nid: impl.auth.app.tokens\ntitle: Tokens\nowners: [{role: t, path: src/auth/tokens}, {role: m, path: src/app.module.ts}]\nproves: []\n');
  put('impl/app/sign-in', 'schema: work/implementation@1\nid: impl.auth.app.sign-in\ntitle: Sign in\nowners: [{role: s, path: src/auth/sign-in}, {role: m, path: src/app.module.ts}]\nproves: [fr.auth.sign-in]\ndependsOn: [impl.auth.app.tokens]\n');
  put('impl/app/register', 'schema: work/implementation@1\nid: impl.auth.app.register\ntitle: Register\nowners: [{role: r, path: src/auth/register}]\nproves: [fr.auth.register]\ndependsOn: [impl.auth.app.tokens]\n');
}

test('backfill builds v0 from the Work tree, marks what it inferred and is idempotent', (t) => withLedger(t, ({ repoRoot, ledger }) => {
  writeWorkTree(repoRoot);
  seedWorkflow(ledger, { id: WF, state: { phase: 'running' }, jobs: jobs([['j-1', 'backend.implement', 'succeeded', ['src/auth/tokens']]]) });
  ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(WF);
  const dry = run(BACKFILL, ['--repo', repoRoot, '--dry-run']);
  assert.equal(dry.status, 0, dry.stderr);
  const w = dry.out.workflows[0];
  assert.equal(w.outcome, 'v0', JSON.stringify(w));
  assert.deepEqual([w.foundations, w.slices, w.tasks, w.frs], [1, 3, 3, 3]);
  assert.equal(latestVersion(ledger.db, WF), null, 'a dry run writes nothing');

  const first = run(BACKFILL, ['--repo', repoRoot, '--apply']);
  assert.equal(first.out.workflows[0].outcome, 'written');
  const v0 = latestVersion(ledger.db, WF);
  assert.equal(v0.event, 'backfill');
  const byId = new Map(v0.graph.nodes.map((n) => [n.id, n]));
  assert.ok(byId.get('auth.foundation').ownedPaths.includes('src/app.module.ts'), 'a path two tasks claim moves to the foundation');
  assert.ok(byId.get('auth.gain-access.app-sign-in').reads.includes('src/app.module.ts'));
  assert.ok(byId.get('auth.audit').inferred.includes('slice'), 'an FR no journey requires is an inferred slice');
  assert.equal(v0.colors['auth.foundation.app-tokens'], 'green', 'colours come from the jobs already run');
  assert.ok(v0.graph.edges.some((e) => e.from === 'auth.foundation.app-tokens' && e.to === 'auth.join.app-register' && e.inferred));

  const second = run(BACKFILL, ['--repo', repoRoot, '--apply']);
  assert.equal(second.out.workflows[0].outcome, 'exists');
  assert.equal(versionsOf(ledger.db, WF).length, 1);
}));
