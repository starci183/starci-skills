import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { fileReport } from '../../engine/db/ledger.mjs';

const workflowId = 'wf-ask-authority', dispatchId = 'ctx-ask-authority';
const start = async (t, repo, extra = []) => {
  const owner = path.join(path.dirname(repo), 'owner'); fs.mkdirSync(owner);
  fs.writeFileSync(path.join(owner, 'config.yaml'), 'language: en\nasks: {autoAcceptRecommended: false}\nconnectors: {telegram: {enabled: false}}\n');
  const child = spawn(process.execPath, [path.resolve(import.meta.dirname, '../../scripts/kernel/ask-server-main.mjs'), '--repo', repo,
    '--workflow', workflowId, '--on-demand', 'fixture', '--ttl', '1500', '--band', '0..0', ...extra],
  { env: { ...process.env, STARCI_LOCAL_ROOT: path.join(path.dirname(repo), 'private-machine'), STARCI_OWNER_ROOT: owner, STARCI_AUTOPILOT: 'off', STARCI_CONNECTORS_OFF: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const exit = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
  t.after(async () => { if (child.exitCode === null) child.kill(); await exit; });
  const bound = await new Promise((resolve, reject) => {
    let out = '', err = ''; child.stderr.on('data', data => err += data);
    child.stdout.on('data', data => { out += data; for (const line of out.split(/\r?\n/)) { try { const parsed = JSON.parse(line); if (parsed.url) { resolve(parsed); return; } } catch {} } });
    child.once('error', reject); child.once('close', () => reject(new Error(`form failed: ${err || out}`)));
  });
  return { ...bound, exit };
};
const seeded = async (t, run) => withLedger(t, async ({ repoRoot, ledger }) => {
  seedWorkflow(ledger, { id: workflowId, jobs: [{ jobId: 'ask-fixture', opId: 'provision.ask', dispatchId, status: 'reported' }] });
  const attemptId = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get('ask-fixture').attempt_id;
  ledger.transaction(db => fileReport(db, { attemptId, outcome: 'ask', report: { schema: 'starci/op-report@1', outcome: 'ask',
    summary: 'credential ask', question: { text: 'Provide FIXTURE_API_TOKEN', options: ['keep', 'continue'] } } }));
  await run(repoRoot, ledger);
});
const answers = ledger => ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='ask-answered'").get().n;

test('POST to --review is denied and listen/TTL write no lifecycle events, receipt or credentials', async t => {
  await seeded(t, async (repo, ledger) => {
    const before = ledger.db.prepare('SELECT count(*) n FROM events').get().n;
    const form = await start(t, repo, ['--review']);
    const response = await fetch(`${form.url}/answer`, { method: 'POST', body: new URLSearchParams({ option: '1', 'env:FIXTURE_API_TOKEN': 'opaque-negative-fixture' }) });
    assert.equal(response.status, 405); await response.text(); await form.exit;
    assert.equal(ledger.db.prepare('SELECT count(*) n FROM events').get().n, before);
    assert.equal(ledger.db.prepare('SELECT count(*) n FROM decisions').get().n, 0);
    assert.equal(fs.existsSync(path.join(repo, '.env.local')), false);
  });
});

test('a rejected actor carrying fake credentials cannot mutate custody or record an answer', async t => {
  await seeded(t, async (repo, ledger) => {
    const form = await start(t, repo);
    const response = await fetch(`${form.url}/answer`, { method: 'POST', body: new URLSearchParams({ option: '1', answered_by: 'unapproved-fixture', 'env:FIXTURE_API_TOKEN': 'opaque-negative-fixture' }) });
    assert.equal(response.status, 403); await response.text();
    assert.equal(answers(ledger), 0);
    assert.equal(ledger.db.prepare('SELECT count(*) n FROM decisions').get().n, 0);
    assert.equal(fs.existsSync(path.join(repo, '.env.local')), false);
    assert.equal(fs.existsSync(path.join(repo, '.starcistacks')), false);
    await form.exit;
  });
});

test('a missing declared custody sink reports failure without a plaintext fallback or accepted receipt', async t => {
  await seeded(t, async (repo, ledger) => {
    const form = await start(t, repo);
    const response = await fetch(`${form.url}/answer`, { method: 'POST', body: new URLSearchParams({ option: '1', 'env:FIXTURE_API_TOKEN': 'opaque-negative-fixture' }) });
    assert.equal(response.status, 502);
    assert.match(await response.text(), /Verified writes: none/);
    assert.equal(answers(ledger), 0);
    assert.equal(ledger.db.prepare('SELECT count(*) n FROM decisions').get().n, 0);
    assert.equal(fs.existsSync(path.join(repo, '.env.local')), false);
    await form.exit;
  });
});

test('a real submission whose answer event is refused cannot leave a filed receipt or decision', async t => {
  await seeded(t, async (repo, ledger) => {
    ledger.db.exec(`CREATE TRIGGER fixture_answer_event_refusal BEFORE INSERT ON events
      WHEN NEW.kind='ask-answered' BEGIN SELECT RAISE(ABORT,'fixture answer event refusal'); END`);
    const before = ledger.db.prepare('SELECT count(*) n FROM job_artifacts').get().n;
    const form = await start(t, repo);
    const response = await fetch(`${form.url}/answer`, { method: 'POST', body: new URLSearchParams({ option: '1' }) });
    assert.equal(response.status, 500); await response.text(); await form.exit;
    assert.equal(answers(ledger), 0);
    assert.equal(ledger.db.prepare('SELECT count(*) n FROM decisions').get().n, 0);
    assert.equal(ledger.db.prepare('SELECT count(*) n FROM job_artifacts').get().n, before);
  });
});
