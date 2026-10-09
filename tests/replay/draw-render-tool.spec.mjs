// Replay of the StarCi stall of 2026-10-09 (registry: draw-render-tool-resolved-from-the-product-only, op-needing-a-host-tool-spends-an-attempt-to-find-it-missing,
// environment-blocker-gate-names-retry-cap-and-the-digest-misses-it, draw-source-entry-never-settles): an interface.draw was dispatched, spent 8M tokens in 66 turns looking for Playwright and
// esbuild in the product (which declares neither), reported blocked environment RENDER_TOOL_UNAVAILABLE, and the failure route opened a supervisor-gate whose recorded
// workaround cause was `retry-cap` (route fired 0 of 1) while the digest, which matched incidents by job_id, said no incident followed the failed leg.
// Sequences: (1) the op's own failing commands run from the workflow tree - `starci work draw-render` found no Playwright, `starci work draw-source` exited 13 (4); (2) the dispatch of the queued draw on a host with
// no browser downloaded; (3) the failure route over the blocked report under the autopilot, then the digest's facts of the ledger.
// Real: the CLI as a child process from the tree (Playwright, esbuild and the Chromium of this host), dispatch-ready and its dispatch child, status, the failure route (reconcile
// --route-failure), the digest's ledger reader. Stubbed: the Orca binary only. A host with no browser is PLAYWRIGHT_BROWSERS_PATH pointing at an empty directory (Playwright's own
// switch). Fixture: tests/fixtures/replay/draw-render-tool.json (extracted from a ledger copy, neutral).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromiumGap } from '../helpers/chromium-gap.mjs';
import { ROOT, STARCI, loadFixture, replayWorld } from '../helpers/replay-world.mjs';
import { loadPlaywright } from '../../scripts/work/draw-render.mjs';
import { ledgerFacts } from '../../scripts/reconciler/debug-digest-collect.mjs';

const fixture = loadFixture('draw-render-tool');
const queuedDraw = { ...fixture, jobs: fixture.jobs.map((job) => (job.op === 'interface.draw' ? { id: job.id, op: job.op, status: 'queued', owned: job.owned, params: job.params } : job)) };
const draw = fixture.jobs.find((job) => job.op === 'interface.draw');
const browserGap = chromiumGap(loadPlaywright([ROOT]).chromium);
const NO_BROWSER = browserGap ? `the capture needs a Chromium download: ${browserGap}` : false;
const PAGE = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0}body{font-family:ui-sans-serif,sans-serif}main{padding:16px}</style></head><body><main><h1>Drawing</h1></main></body></html>';

const push = (world, extraEnv = {}) => world.cli('dispatch-ready', ['--workflow', world.wf, '--foreground'], { timeout: 300_000, extraEnv }).json.results[0] ?? { dispatched: false, error: 'the push listed no job' };
const emptyBrowserCache = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-replay-no-browser-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { PLAYWRIGHT_BROWSERS_PATH: dir };
};

test('1: the op\'s own command renders from a workflow tree that holds no Playwright and no esbuild (the runtime\'s install serves)', { skip: NO_BROWSER }, (t) => {
  const world = replayWorld(t, fixture, { tree: true });
  world.tree.write('drawing.html', PAGE);
  const out = path.join(world.tree.dir, 'captures');
  assert.equal(fs.existsSync(path.join(world.tree.dir, 'node_modules')), false, 'the tree is a fresh worktree: no install');
  const r = spawnSync(process.execPath, [STARCI, 'work', 'draw-render', '--html', path.join(world.tree.dir, 'drawing.html'), '--out', out, '--viewports', '390x844', '--json'],
    { cwd: world.tree.dir, encoding: 'utf8', windowsHide: true, timeout: 180_000, env: world.env });
  assert.equal(r.status, 0, `the capture rendered (exit ${r.status}): ${String(r.stdout).slice(-400)} ${String(r.stderr).slice(-400)}`);
  assert.ok(fs.readdirSync(out).some((name) => name.endsWith('.png')), 'a png was written');
});

test('2: a host with no browser refuses the dispatch of the draw before an attempt is spent, and status holds the job as host-tool-missing', (t) => {
  const world = replayWorld(t, queuedDraw, { tree: true, launch: true });
  const bare = emptyBrowserCache(t);
  Object.assign(world.env, bare);
  assert.equal(world.ack([draw.op]).status, 0, 'the Kernel attests its READ of the op');
  const attemptsBefore = world.ledger((ledger) => ledger.db.prepare('SELECT count(*) n FROM op_attempts').get().n);
  const listed = world.cli('dispatch-ready', ['--workflow', world.wf, '--foreground'], { timeout: 300_000 }).json.results ?? [];
  assert.deepEqual(listed.filter((result) => result.jobId === draw.id), [], 'the push does not list a job the host cannot run: status never reads it ready');
  const refused = world.cli('dispatch', ['--job', draw.id, '--spawn']);
  assert.equal(refused.status, 1, refused.stderr || refused.stdout);
  assert.equal(refused.json.reason, 'prerequisite-unmet');
  assert.equal(refused.json.code, 'RENDER_TOOL_UNAVAILABLE', 'the refusal carries the catalogued code');
  assert.match(refused.json.detail, /npx playwright install chromium/, 'and what provisions the tool');
  assert.equal(world.ledger((ledger) => ledger.db.prepare('SELECT count(*) n FROM op_attempts').get().n), attemptsBefore, 'no attempt was spent');
  assert.equal(world.ledger((ledger) => ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='op-dispatched'").get().n), 0, 'no worker was launched');
  const status = world.status();
  const held = status.frontier.queued.find((item) => item.jobId === draw.id);
  assert.equal(held.queuedBecause, 'host-tool-missing');
  assert.deepEqual(held.blockedBy.missing, ['chromium']);
  assert.equal(status.frontier.actionable, false, 'nothing wakes the Kernel for a wait only the host\'s owner ends');
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1 }).ok, true, 'the engine restarts over the held job');
  assert.equal(world.status().frontier.queued.find((item) => item.jobId === draw.id).queuedBecause, 'host-tool-missing', 'still held after the restart');
});

test('2b: the same job on a host that has the tools goes on to launch', (t) => {
  const world = replayWorld(t, queuedDraw, { tree: true, launch: true });
  assert.equal(world.ack([draw.op]).status, 0);
  const result = push(world);
  assert.doesNotMatch(String(result.error ?? ''), /RENDER_TOOL_UNAVAILABLE|host-tool-missing/, `the tools resolve from the runtime: ${result.error}`);
  assert.equal(typeof result.dispatched, 'boolean');
});

test('3: a blocked environment report under the autopilot opens one supervisor-gate that names the host, not a spent retry cap, and the digest facts see it hold the leg', (t) => {
  const world = replayWorld(t, fixture, { tree: true });
  const routed = world.cli('reconcile', ['--route-failure', '--job', draw.id, '--workflow', world.wf], { extraEnv: { STARCI_AUTOPILOT: 'on' } });
  assert.equal(routed.status, 0, routed.stderr || routed.stdout);
  const raised = world.ledger((ledger) => ledger.db.prepare("SELECT payload_json FROM events WHERE kind='incident-raised' AND entity_type='incident'").all().map((row) => JSON.parse(row.payload_json)));
  assert.equal(raised.length, 1, 'one gate, one item');
  assert.equal(raised[0].kind, 'supervisor-gate');
  assert.deepEqual(raised[0].holds, [draw.id]);
  assert.equal(raised[0].workaround.cause, 'host-not-ready', 'the recorded cause is the host, not a retry cap that never fired');
  const [facts] = ledgerFacts(world.ledgerFile);
  const gate = facts.incidents.find((incident) => incident.holds.includes(draw.id));
  assert.ok(gate, 'the digest facts carry the jobs a gate holds');
  assert.equal(gate.jobId, null, 'the gate has no job_id of its own: the holds are the link');
});

test('4: the op\'s second failing command, starci work draw-source, answers from the tree instead of hanging on its own entry (registry: draw-source-entry-never-settles)', (t) => {
  const world = replayWorld(t, fixture, { tree: true });
  world.tree.write('Form.draw.tsx', 'export const FormBase = () => null;\n');
  const r = spawnSync(process.execPath, [STARCI, 'work', 'draw-source', path.join(world.tree.dir, 'Form.draw.tsx'), '--json'], { cwd: world.tree.dir, encoding: 'utf8', windowsHide: true, timeout: 180_000, env: world.env });
  assert.notEqual(r.status, 13, `the entry module settles (exit 13 is Node's unsettled top-level await): ${String(r.stderr).slice(-300)}`);
  assert.ok([0, 1].includes(r.status), `the gate answered with a verdict (exit ${r.status}): ${String(r.stderr).slice(-300)}`);
  assert.equal(typeof JSON.parse(r.stdout).ok, 'boolean', 'and printed it');
});
