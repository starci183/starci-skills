import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { JOB_ARTIFACT_KINDS, JOB_ARTIFACT_SUBKINDS, ledgerFileFor, openLedger } from '../engine/ledger-db.mjs';
import { LOG_KINDS } from '../scripts/kernel/typed-logs.mjs';
import { ENDPOINTS, STREAMS, interfaceShapes, validateEndpoint, validateShape } from '../ui/contract-shapes.mjs';

// The harness data contract (ui/CONTRACT.md): ui/src/contract.ts and ui/contract-shapes.mjs describe the same fields,
// every captured fixture (ui/fixtures) fits them, and the real ui/server.mjs - started on a fixture ledger, never the
// live port - answers every endpoint in that shape.
const ROOT = path.resolve(import.meta.dirname, '..');
const UI = path.join(ROOT, 'ui');
const FIXTURES = path.join(UI, 'fixtures');
const CONTRACT_TS = fs.readFileSync(path.join(UI, 'src', 'contract.ts'), 'utf8');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000002000154a24f5d0000000049454e44ae426082', 'hex');

/** `export interface Name { field?: ...; }` -> Map(name -> Map(field -> optional)). Nested object literals are skipped. */
function interfacesOf(source) {
  const out = new Map();
  const re = /export interface (\w+)(?:\s+extends\s+[\w, ]+)?\s*\{/g;
  let m;
  while ((m = re.exec(source))) {
    let depth = 1, i = re.lastIndex, body = '';
    for (; i < source.length && depth; i++) { const c = source[i]; if (c === '{') depth++; else if (c === '}') depth--; if (depth) body += c; }
    const fields = new Map();
    let level = 0, text = '';
    for (const c of body) { if (c === '{' || c === '(' || c === '<' || c === '[') level++; else if (c === '}' || c === ')' || c === '>' || c === ']') level--; else if (level === 0) text += c; if (level > 0 || c === '}' || c === ')' || c === '>' || c === ']') text += ' '; }
    const clean = text.replace(/\/\*\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    for (const f of clean.matchAll(/(?:^|[;\n{\s])'?([\w.-]+)'?(\?)?\s*:/g)) fields.set(f[1], Boolean(f[2]));
    out.set(m[1], fields);
  }
  return out;
}
const unionOf = (name) => {
  const m = new RegExp(`export type ${name} =([^;]+);`).exec(CONTRACT_TS);
  assert.ok(m, `contract.ts declares type ${name}`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
};

test('contract.ts and contract-shapes.mjs describe the same interfaces, field for field', () => {
  const ts = interfacesOf(CONTRACT_TS);
  const shapes = interfaceShapes();
  assert.ok(shapes.size > 60, `every response object is a named shape (${shapes.size})`);
  for (const [name, shape] of shapes) {
    assert.ok(ts.has(name), `contract.ts has no interface ${name}`);
    const fields = ts.get(name);
    assert.deepEqual([...fields.keys()].sort(), Object.keys(shape.fields).sort(), `${name}: fields differ`);
    for (const [field, optional] of fields) assert.equal(Boolean(shape.fields[field].optional), optional, `${name}.${field}: optional differs`);
  }
});

test('contract.ts vocabularies are the runtime\'s own', () => {
  assert.deepEqual(unionOf('ArtifactKind').sort(), [...JOB_ARTIFACT_KINDS].sort());
  assert.deepEqual(unionOf('ArtifactSubkind').sort(), [...JOB_ARTIFACT_SUBKINDS].sort());
  assert.deepEqual(unionOf('LogKind').sort(), Object.keys(LOG_KINDS).sort());
  const logData = interfacesOf(CONTRACT_TS).get('LogData');
  assert.deepEqual([...logData.keys()].sort(), Object.keys(LOG_KINDS).sort(), 'LogData types every log kind');
  assert.match(CONTRACT_TS, /export const CONTRACT_VERSION = '\d{4}-\d{2}-\d{2}\.\d+';/);
});

test('every fixture fits its endpoint\'s shape; every required endpoint has a fixture', () => {
  const files = fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.json'));
  const names = files.map((f) => f.replace(/\.json$/, ''));
  for (const required of ['snapshot', 'contract', 'agents', 'evidence', 'history', 'history-commit', 'proofs', 'artifacts', 'workflow-events', 'logs', 'diff', 'workflow-events-stream', 'logs-stream']) {
    assert.ok(names.includes(required), `ui/fixtures/${required}.json is captured`);
  }
  for (const name of names) {
    const doc = JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'));
    assert.equal(doc.status, 200, `${name} was captured from a 200`);
    assert.match(doc.endpoint, /^\/api\//);
    if (STREAMS[name]) {
      assert.ok(Array.isArray(doc.events) && doc.events.length, `${name} holds stream events`);
      doc.events.forEach((e, i) => assert.deepEqual(validateEndpoint(STREAMS[name], e.data), [], `${name} event ${i}`));
    } else {
      assert.ok(ENDPOINTS[name], `${name} is a contract endpoint`);
      assert.deepEqual(validateEndpoint(name, doc.body), [], `${name} fits the contract`);
    }
  }
});

test('the validator itself: a missing field, a wrong type, an unknown key and a bad enum are findings', () => {
  const row = { seq: 1, at: 1, workflowId: 'wf', jobId: null, actor: 'op', nodeId: null, level: 'info', kind: 'cmd.run', msg: 'm', data: { cmd: 'x', exit: 0 }, refs: [] };
  assert.deepEqual(validateEndpoint('log-row', row), []);
  assert.match(validateEndpoint('log-row', { ...row, seq: 1.5 }).join(), /\$\.seq: expected integer/);
  assert.match(validateEndpoint('log-row', { ...row, extra: 1 }).join(), /\$\.extra: not in the contract/);
  assert.match(validateEndpoint('log-row', { ...row, actor: 'someone' }).join(), /is not one of/);
  assert.match(validateEndpoint('log-row', { ...row, data: { cmd: 'x' } }).join(), /data\.exit is required/);
  const { msg, ...noMsg } = row;
  assert.match(validateEndpoint('log-row', noMsg).join(), /\$\.msg: missing/);
  assert.deepEqual(validateShape(ENDPOINTS['workflow-event'], null), ['$: null is not allowed']);
});

// --------------------------------------------------------------------------------------- fixture server
const git = (cwd, ...args) => { const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
const write = (root, rel, body) => { const abs = path.join(root, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, body); return abs; };

/** A product repo whose ledger holds one settled op job (real api settle: artifacts, patch json, typed logs). */
function fixtureRepo(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-contract-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 30, retryDelay: 50 }));
  const origin = path.join(dir, 'origin.git'), repo = path.join(dir, 'work');
  git(dir, 'init', '--quiet', '--bare', origin); git(dir, 'clone', '--quiet', origin, repo);
  git(repo, 'config', 'user.email', 'lane@starci.test'); git(repo, 'config', 'user.name', 'lane'); git(repo, 'config', 'core.autocrlf', 'false');
  git(repo, 'checkout', '--quiet', '-b', 'main');
  write(repo, 'src/a.ts', 'export const a = 1;\n'); write(repo, '.gitignore', '.starciwork/\n');
  git(repo, 'add', '.'); git(repo, 'commit', '--quiet', '-m', 'init');
  write(repo, 'src/a.ts', 'export const a = 2;\nexport const b = 3;\n');
  git(repo, 'add', 'src/a.ts'); git(repo, 'commit', '--quiet', '-m', 'edit a');
  const head = git(repo, 'rev-parse', 'HEAD');
  write(repo, '.starciwork/features/f/impl/fe/view/E/screens/home--desktop.png', PNG);
  const wf = 'wf-contract-fixture', jobId = 'op-backend.implement-fx1', op = 'backend.implement';
  const j = JSON.stringify;
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    ledger.ensureWorkflow({ workflowId: wf, title: 'contract fixture' });
    ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(wf);
    ledger.enqueueJob({ jobId, workflowId: wf, opId: op, kind: 'op', payload: { opId: op, owned_paths: ['src/'], model: 'claude-agent', orca: { dispatchId: `ctx-${jobId}`, agentTerminalHandle: `term-${jobId}` } } });
    ledger.db.prepare('UPDATE jobs SET status=? WHERE job_id=?').run('running', jobId);
    ledger.appendEvent({ workflowId: wf, entityType: 'job', entityId: jobId, kind: 'op-dispatched', payload: { op, attempt: 1, model: 'claude-agent', dispatch: `ctx-${jobId}` } });
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)').run(wf, op, 1, `ctx-${jobId}`, '# contract', j({ worktree: repo }), Date.now());
    const checks = [{ name: 'unit', command: 'npm test', exitCode: 0, evidence: 'green' }];
    ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(wf, `ctx-${jobId}`, op, 1, 0, 'done', j({ outcome: 'done', summary: 'fixture', head, branch: 'main', checks, files: ['.starciwork/features/f/impl/fe/view/E/screens/home--desktop.png', 'src/a.ts'] }), null, Date.now());
    ledger.appendEvent({ workflowId: wf, entityType: 'job', entityId: jobId, kind: 'report-filed', payload: { op, attempt: 1, outcome: 'done', dispatchId: `ctx-${jobId}` } });
    ledger.db.prepare('INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)').run(wf, op, 1, j({ checks }), Date.now());
    ledger.appendEvent({ workflowId: wf, entityType: 'job', entityId: jobId, kind: 'checks-recorded', payload: { op, attempt: 1 } });
  } finally { ledger.close(); }
  const settle = spawnSync(process.execPath, [API, 'settle', '--repo', repo, '--job', jobId, '--verdict', 'pass', '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 180000, env: { ...process.env, STARCI_ROLE: '', STARCI_OP_JOB: '' } });
  assert.equal(settle.status, 0, settle.stderr || settle.stdout);
  return { repo, wf, jobId, op };
}

/** ui/server.mjs on a free port over `projects`, offline (no supervisor CLIs); resolves {base, stop}. */
async function startServer(t, projects) {
  const child = spawn(process.execPath, [path.join(UI, 'server.mjs')], { cwd: UI, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, STARCI_STATUS_PORT: '0', STARCI_STATUS_OFFLINE: '1', STARCI_STATUS_PROJECTS: JSON.stringify(projects) } });
  t.after(() => { try { child.kill(); } catch { /* gone */ } });
  const base = await new Promise((resolve, reject) => {
    let out = '', err = '';
    const timer = setTimeout(() => reject(new Error(`server did not start: ${out}${err}`)), 60000);
    child.stdout.on('data', (d) => { out += d; const m = /http:\/\/127\.0\.0\.1:(\d+)/.exec(out); if (m) { clearTimeout(timer); resolve(`http://127.0.0.1:${m[1]}`); } });
    child.stderr.on('data', (d) => { err += d; });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`server exited ${code}: ${err}`)); });
  });
  return base;
}
const getJson = async (base, url) => { const res = await fetch(`${base}${url}`); return { status: res.status, body: await res.json().catch(() => null) }; };
const firstEvents = async (base, url, want = 1, ms = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const events = [];
  try {
    const res = await fetch(`${base}${url}`, { signal: controller.signal });
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const reader = res.body.getReader();
    let buf = '';
    while (events.length < want) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += Buffer.from(value).toString('utf8');
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) { const block = buf.slice(0, i); buf = buf.slice(i + 2); const data = /^data: (.*)$/m.exec(block)?.[1]; if (data) events.push(JSON.parse(data)); }
    }
  } catch (error) { if (error?.name !== 'AbortError') throw error; } finally { clearTimeout(timer); controller.abort(); }
  return events;
};

test('the fixture server answers every endpoint in the contract\'s shape (never the live port)', async (t) => {
  const { repo, wf, jobId, op } = fixtureRepo(t);
  const base = await startServer(t, [{ id: 'fx', name: 'Fixture', repo }]);
  assert.doesNotMatch(base, /:454[67]$/, 'a fixture server, not the live one');
  const q = (o) => new URLSearchParams(o).toString();
  const check = async (name, url) => {
    const r = await getJson(base, url);
    assert.equal(r.status, 200, `${name}: HTTP ${r.status} ${JSON.stringify(r.body)}`);
    assert.deepEqual(validateEndpoint(name, r.body), [], `${name} fits the contract`);
    return r.body;
  };
  const contract = await check('contract', '/api/contract');
  assert.deepEqual(contract.artifactSubkinds, [...JOB_ARTIFACT_SUBKINDS]);
  assert.match(contract.version, /^\d{4}-\d{2}-\d{2}\.\d+$/);
  const snap = await check('snapshot', '/api/snapshot');
  assert.equal(snap.projects[0].workflows[0].id, wf);
  const arts = await check('artifacts', `/api/artifacts?${q({ project: 'fx', workflow: wf })}`);
  const subkinds = arts.jobs[0].artifacts.map((a) => a.subkind);
  for (const sk of ['app-capture', 'patch', 'patch-json', 'report']) assert.ok(subkinds.includes(sk), `artifacts carry subkind ${sk}`);
  const onlyCaptures = await check('artifacts', `/api/artifacts?${q({ project: 'fx', workflow: wf, subkind: 'app-capture' })}`);
  assert.equal(onlyCaptures.total, 1);
  await check('workflow-events', `/api/workflow-events?${q({ project: 'fx', workflow: wf })}`);
  const logs = await check('logs', `/api/logs?${q({ project: 'fx', workflow: wf })}`);
  const kinds = new Set(logs.rows.map((r) => r.kind));
  for (const kind of ['dispatch', 'report', 'check.result', 'cmd.run', 'settle', 'file.edit', 'render', 'warning']) assert.ok(kinds.has(kind), `the timeline has ${kind}`);
  const diff = await check('diff', `/api/diff?${q({ project: 'fx', job: jobId })}`);
  assert.equal(diff.files[0].path, 'src/a.ts');
  const proofs = await check('proofs', `/api/proofs?${q({ project: 'fx', workflow: wf, op })}`);
  assert.equal(proofs.jobs[0].jobId, jobId);
  await check('evidence', '/api/evidence?limit=5');
  const wfEvents = await firstEvents(base, `/api/workflow-events/stream?${q({ project: 'fx', workflow: wf })}`, 2);
  assert.ok(wfEvents.length >= 1);
  wfEvents.forEach((e, i) => assert.deepEqual(validateEndpoint('workflow-event', e), [], `workflow-event ${i}`));
  const logEvents = await firstEvents(base, `/api/logs/stream?${q({ project: 'fx', workflow: wf, limit: 5 })}`, 2);
  assert.ok(logEvents.length >= 1);
  logEvents.forEach((e, i) => assert.deepEqual(validateEndpoint('log-row', e), [], `log-row ${i}`));
  assert.equal((await getJson(base, `/api/artifacts?${q({ project: 'nivo', workflow: wf })}`)).status, 404, 'only the served projects answer');
  assert.equal((await getJson(base, `/api/coverage?${q({ project: 'fx', workflow: wf })}`)).status, 502, 'an offline server says it cannot run a verb, never invents data');
});
