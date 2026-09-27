// scripts/work/migrate-runtime.mjs audits a product repo against the runtime model: storage it fixes (--apply: the
// ledger tables schema.sql adds, old-shaped ui records), a running workflow's own state it only reports with the
// landed command that fixes it. backfill-work-graph attaches the shapes of a nested ui record to the record it sits
// under (nivo wf-nivo-modules-agentos-mudqjov6 / wf-nivo-workspace-provision-mudqjokb were refused SHAPE_UNCOVERED),
// and migrate-ui-shapes keeps the flow states of a record that already declares its shapes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectLedger, ledgerFileFor, openLedger } from '../engine/ledger-db.mjs';
import { planRecord } from '../scripts/work/migrate-ui-shapes.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const MIGRATE = path.join(ROOT, 'scripts', 'work', 'migrate-runtime.mjs');
const BACKFILL = path.join(ROOT, 'scripts', 'work', 'backfill-work-graph.mjs');
const WF = 'wf-migrate';
const json = (v) => JSON.stringify(v ?? null);
const run = (script, args) => {
  const r = spawnSync(process.execPath, [script, ...args, '--json'], { encoding: 'utf8', cwd: ROOT, windowsHide: true, timeout: 300000 });
  let out = null; try { out = JSON.parse(r.stdout); } catch { /* asserted by status */ }
  return { status: r.status, out, stderr: r.stderr };
};

function world(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-migrate-runtime-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const f = path.join(repo, '.starciwork', 'features', 'shop');
  const put = (rel, text) => { fs.mkdirSync(path.join(f, rel), { recursive: true }); fs.writeFileSync(path.join(f, rel, 'index.yaml'), text); };
  fs.mkdirSync(f, { recursive: true });
  fs.writeFileSync(path.join(f, 'index.yaml'), `schema: work/feature@1\nid: shop\ntitle: Shop\ndescription: Shop.\nextensions:\n  work3:\n    scope:\n      request: {workflow: ${WF}, goalIdentity: g, goalRevision: 0, outcome: Shop works.}\n      nodes: []\n      deps: []\n      exclusions: []\n`);
  put('data/order', 'schema: work/data@1\nid: data.shop.order\ntitle: Order\n');
  put('fr/browse', 'schema: work/functional-requirement@1\nid: fr.shop.browse\ntitle: Browse\n');
  put('fr/pay', 'schema: work/functional-requirement@1\nid: fr.shop.pay\ntitle: Pay\n');
  put('journey/buy', 'schema: work/customer-journey@1\nid: journey.shop.buy\ntitle: Buy\nrequirements: [fr.shop.pay]\n');
  const ui = (id, base, states, refs) => `schema: work/ui-screen@1\nid: ${id}\ntitle: ${id}\nrefs: [${refs.join(', ')}]\nui:\n  shapes:\n${states.map((s) => `    - {base: ${base}, state: ${s}, viewports: [desktop, mobile]}`).join('\n')}\n`;
  // A screen record and a part record nested under it: the part's shapes belong to the screen's task.
  put('ui/catalog', ui('ui.shop.catalog', 'CatalogBase', ['browsing'], ['fr.shop.browse']));
  put('ui/catalog/filters', ui('ui.shop.catalog.filters', 'FiltersBase', ['open', 'applied'], ['fr.shop.browse']));
  // A nested record under a folder that is no ui record: its shapes go to the slice its refs name.
  put('ui/checkout-parts/receipt', ui('ui.shop.checkout.receipt', 'ReceiptBase', ['paid'], ['fr.shop.pay']));

  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    ledger.ensureWorkflow({ workflowId: WF, title: 'migrate' });
    ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(WF);
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(WF, 0, 'g0', '# goal', json({ derivedPlan: { legs: ['interface.draw', 'docs.author', 'docs.review'].map((op) => ({ op })) } }), Date.now());
    const job = (jobId, op, attempt, status, paths, result = null) => {
      ledger.enqueueJob({ jobId, workflowId: WF, opId: op, attempt, kind: 'op', payload: { opId: op, owned_paths: paths } });
      ledger.db.prepare('UPDATE jobs SET status=?, result_json=? WHERE job_id=?').run(status, result ? json(result) : null, jobId);
    };
    // Settled fail before the router; a later attempt re-ran the same paths.
    job('j-old', 'docs.author', 1, 'failed', ['docs/a'], { verdict: 'fail' });
    job('j-new', 'docs.author', 2, 'queued', ['docs/a']);
    // Settled fail before the router; nothing re-ran it.
    job('j-lost', 'docs.review', 1, 'failed', ['docs/b'], { verdict: 'fail' });
    // A blocked settle records no step by design.
    job('j-blocked', 'docs.review', 2, 'failed', ['docs/c'], { verdict: 'blocked' });
    // A drawing that succeeded with no admitted contract row: no follow-up can be proved for it.
    job('j-draw', 'interface.draw', 1, 'succeeded', ['.starciwork/features/shop/ui/catalog']);
  } finally { ledger.close(); }
  const read = (fn) => { const l = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(l.db); } finally { l.close(); } };
  return { repo, read };
}

test('backfill attaches a nested ui record\'s shapes to the record it sits under, else to its refs\' slice', (t) => {
  const { repo } = world(t);
  const r = run(BACKFILL, ['--repo', repo, '--dry-run']);
  assert.equal(r.status, 0, r.stderr);
  const w = r.out.workflows[0];
  assert.equal(w.outcome, 'v0', JSON.stringify(w.findings));
  assert.equal(w.shapes, 4);
  const applied = run(BACKFILL, ['--repo', repo, '--apply']);
  assert.equal(applied.out.workflows[0].outcome, 'written');
  const l = inspectLedger({ file: ledgerFileFor(repo) });
  try {
    const graph = JSON.parse(l.db.prepare('SELECT graph_json FROM work_graph_versions WHERE workflow_id=?').get(WF).graph_json);
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const catalog = graph.nodes.find((n) => (n.shapes ?? []).includes('CatalogBase#browsing'));
    assert.deepEqual([...catalog.shapes].sort(), ['CatalogBase#browsing', 'FiltersBase#applied', 'FiltersBase#open']);
    assert.ok(catalog.inferred.includes('shapes'), 'a shape taken from a nested record is marked inferred');
    const receipt = graph.nodes.find((n) => (n.shapes ?? []).includes('ReceiptBase#paid'));
    assert.equal(receipt.id, 'shop.buy', 'no ui record above it: the slice its FR belongs to');
    assert.ok(byId.get('shop.buy').inferred.includes('shapes'));
  } finally { l.close(); }
});

test('migrate-ui-shapes keeps the flow states of a record that already declares its shapes', () => {
  const record = { schema: 'work/ui-screen@1', id: 'ui.x.sign-in', ui: {
    surfaces: [{ name: 'sign-in' }],
    states: [{ name: 'signed-out' }, { name: 'code' }, { name: 'code-pending' }, { name: 'choose-context' }],
    shapes: [{ base: 'SignInBase', state: 'signed-out', viewports: ['desktop'] }, { base: 'SignInBase', state: 'code', viewports: ['desktop'] }] } };
  const plan = planRecord(record);
  assert.equal(plan.changed, false, 'a redraw that chose two shapes is not re-derived into four');
});

test('the audit reports workflow state, applies only storage, and is idempotent', (t) => {
  const { repo, read } = world(t);
  const l = openLedger({ file: ledgerFileFor(repo) });
  try { l.db.exec('DROP TABLE work_graph_versions'); } finally { l.close(); }
  const jobsBefore = read((db) => db.prepare('SELECT job_id,status,result_json FROM jobs ORDER BY job_id').all());

  const dry = run(MIGRATE, ['--repo', repo, '--dry-run']);
  assert.equal(dry.status, 0, dry.stderr);
  const codes = (audit) => [...audit.schema, ...audit.ui, ...audit.workflows.flatMap((w) => w.findings)].map((f) => `${f.fix}:${f.code}:${f.subject}`).sort();
  const found = codes(dry.out.before);
  assert.ok(found.includes('apply:schema-table-missing:work_graph_versions'), found.join('\n'));
  assert.ok(found.includes('note:failed-superseded:j-old'), found.join('\n'));
  assert.ok(found.includes('report:failed-without-next-step:j-lost'), found.join('\n'));
  assert.ok(!found.some((c) => c.includes('j-blocked')), 'a blocked settle owes no router step');
  assert.ok(found.includes('owner:follow-up-unprovable:j-draw'), found.join('\n'));
  assert.ok(found.includes(`report:work-graph-missing:${WF}`), found.join('\n'));
  assert.ok(found.includes(`note:plan-linear:${WF}`), found.join('\n'));
  const lost = dry.out.before.workflows[0].findings.find((f) => f.subject === 'j-lost');
  assert.match(lost.command, /api\.mjs enqueue .*--retry-of j-lost/);

  const applied = run(MIGRATE, ['--repo', repo, '--apply']);
  assert.equal(applied.status, 0, applied.stderr);
  assert.ok(!codes(applied.out.after).some((c) => c.startsWith('apply:')), 'storage findings are gone after --apply');
  assert.ok(codes(applied.out.after).includes('report:failed-without-next-step:j-lost'), 'workflow state is only reported');
  assert.deepEqual(read((db) => db.prepare('SELECT job_id,status,result_json FROM jobs ORDER BY job_id').all()), jobsBefore, 'no job was written');
  assert.equal(read((db) => db.prepare('SELECT COUNT(*) n FROM work_graph_versions').get().n), 0, 'no work graph was written');

  const again = run(MIGRATE, ['--repo', repo, '--apply']);
  assert.equal(again.status, 0, again.stderr);
  assert.deepEqual(again.out.applied, []);
});
