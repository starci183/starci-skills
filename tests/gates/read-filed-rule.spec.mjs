// One rule owns an op's required READ set (filedRequiredReads, scripts/kernel/required-read.mjs): `starci gate read` run inside an
// op records every filed required ref whatever --touch says, judgeFiledRead requires them at settle, and the op prompt words the
// literal command. Each case files the real dispatch contract, runs the real CLI exactly as the prompt words it, then judges.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { seedWorkflow, withLedger } from '../helpers/ledger-fixture.mjs';
import { fileDispatchContract } from '../helpers/filed-contract.mjs';
import { guardsRoot } from '../../scripts/guards/guards-root.mjs';
import { observationContextOf, judgeFiledRead } from '../../scripts/kernel/mechanism-observation.mjs';
import { buildOpPrompt } from '../../scripts/kernel/op-prompt.mjs';
import { filedRequiredReads } from '../../scripts/lib/filed-reads.mjs';
import { loadOpGate } from '../../scripts/gates/read-digest.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CLI = path.join(ROOT, 'packages', 'cli', 'bin', 'starci.mjs');
// The READ lines the op prompt renders; the literal command of one is its text between the arrow and the dash.
const promptLines = buildOpPrompt({ skillRoot: ROOT, packet: { op: 'docs.author', brief: 'modules/ops/ops/docs.author.yaml', context: { records: [], owned_paths: [], attempt: 1 }, constraints: { model: 'm' } } })
  .split('\n').filter((line) => line.startsWith('  starci-read-digest'));
const codeLine = promptLines.find((line) => !line.includes('(deciding and authoring ops)')), authoringLine = promptLines.find((line) => line.includes('(deciding and authoring ops)'));
const commandOf = (line, { root, touch, out }) => line.split(' \u2192 ')[1].split(' \u2014 ')[0]
  .replace(/\[--touch (<[^>]*>)\]/, '--touch $1').replace(/ \[--knowledge <[^>]*>\]/, '').replace('<app>', root).replace(/ ?--touch <[^>]*>/, touch.length ? ` --touch ${touch.join(' ')}` : '')
  .replace(/<STARCI_JOB_SCRATCH>\/read-digest\.json/, out).split(' ').slice(1);

const git = (cwd, ...args) => assert.equal(spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).status, 0, `git ${args.join(' ')}`);

// Files the dispatch contract of `op` in a git target and binds a terminal to its job.
function fileOp(t, ctx, { op, owned }) {
  git(ctx.repoRoot, 'init', '-q', '-b', 'main');
  for (const [key, value] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false'], ['commit.gpgsign', 'false']]) git(ctx.repoRoot, 'config', key, value);
  fs.writeFileSync(path.join(ctx.repoRoot, 'README.md'), 'target\n');
  git(ctx.repoRoot, 'add', 'README.md');
  git(ctx.repoRoot, 'commit', '-q', '-m', 'init');
  const jobId = `job-${op}`, handle = `term-${op}-${process.pid}`;
  seedWorkflow(ctx.ledger, { id: `wf-${op}`, jobs: [{ jobId, opId: op, status: 'running', terminalHandle: handle, payload: { opId: op, owned_paths: owned } }] });
  fileDispatchContract(ctx.ledger, { jobId, repo: ctx.repoRoot, createdAt: Date.now() - 60_000 });
  fs.mkdirSync(path.join(guardsRoot(), 'terminals'), { recursive: true });
  const guard = path.join(guardsRoot(), 'terminals', `${handle}.json`);
  fs.writeFileSync(guard, JSON.stringify({ schema: 'starci/op-guard@1', role: 'op', terminal: handle, jobId, workflowId: `wf-${op}`, ledgerRepo: ctx.repoRoot }));
  t.after(() => fs.rmSync(guard, { force: true }));
  const job = ctx.ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  return { handle, context: observationContextOf(ctx.ledger.db, job, { repo: ctx.repoRoot, skillRoot: ROOT }) };
}
// The real CLI, worded as the prompt words it; `handle` null runs outside any op.
function readCli(ctx, { handle, touch, line = authoringLine, name = 'read-digest.json' }) {
  const out = path.join(ctx.root, name), env = { ...process.env };
  delete env.ORCA_TERMINAL_HANDLE;
  if (handle) env.ORCA_TERMINAL_HANDLE = handle;
  const run = spawnSync(process.execPath, [CLI, ...commandOf(line, { root: ctx.repoRoot, touch, out })],
    { cwd: ROOT, env, encoding: 'utf8', windowsHide: true, timeout: 180000 });
  return { run, digest: run.status === 0 ? JSON.parse(fs.readFileSync(out, 'utf8')) : null };
}
const judge = (digest, context) => judgeFiledRead(digest, context, loadOpGate(), []);

test('the op prompt words the one literal READ command and its rule', () => {
  assert.ok(codeLine && authoringLine, 'the prompt renders both READ lines');
  assert.deepEqual(commandOf(codeLine, { root: 'APP', touch: ['a.ts'], out: 'OUT' }), ['gate', 'read', '--root', 'APP', '--touch', 'a.ts', '--out', 'OUT']);
  assert.deepEqual(commandOf(authoringLine, { root: 'APP', touch: [], out: 'OUT' }), ['gate', 'read', '--root', 'APP', '--out', 'OUT']);
  for (const line of [codeLine, authoringLine]) assert.match(line, /names every READ input filed for this op/);
});

test('docs.author following the prompt literally (--touch of its document) passes READ: the filed catalog stays covered', (t) => withLedger(t, async (ctx) => {
  const { handle, context } = fileOp(t, ctx, { op: 'docs.author', owned: ['docs/'] }), { run, digest } = readCli(ctx, { handle, touch: ['docs/change.md'] });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const required = filedRequiredReads(context.readRefs, context.selected.contract.reads);
  assert.ok(required.size > 100, `docs.author files the whole example catalog (${required.size})`);
  assert.deepEqual([...required].filter((rel) => !digest.files.some((file) => file.path === rel)), []);
  assert.equal(judge(digest, context), null);
  const omitted = [...required].find((rel) => rel.startsWith('examples/') && rel !== 'examples/index.yaml');
  const refused = judge({ ...digest, files: digest.files.filter((file) => file.path !== omitted) }, context);
  assert.equal(refused?.code, 'op-read-digest-no-knowledge', 'a digest that omits one filed example is still refused');
  const knowledge = [...required].find((rel) => rel.startsWith('knowledge/'));
  assert.equal(judge({ ...digest, files: digest.files.filter((file) => file.path !== knowledge) }, context)?.code, 'op-read-digest-no-knowledge');
  assert.equal(judge({ ...digest, files: digest.files.map((file) => file.path === knowledge ? { ...file, role: 'read' } : file) }, context)?.code, 'op-read-digest-no-knowledge');
}));

test('a code op following the prompt literally (--touch of its files) passes READ', (t) => withLedger(t, async (ctx) => {
  const { handle, context } = fileOp(t, ctx, { op: 'backend.implement', owned: ['be/'] }), { run, digest } = readCli(ctx, { handle, touch: ['be/src/a.service.ts'], line: codeLine });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.deepEqual(digest.touched, ['be/src/a.service.ts'], '--touch still names the slice');
  assert.ok(filedRequiredReads(context.readRefs, context.selected.contract.reads).size > 0);
  assert.equal(judge(digest, context), null);
  const required = [...filedRequiredReads(context.readRefs, context.selected.contract.reads)];
  assert.equal(judge({ ...digest, files: digest.files.filter((file) => file.path !== required[0]) }, context)?.code, 'op-read-digest-no-knowledge');
}));

test('the filed set needs no --touch inside an op, and outside an op --touch alone keeps its slot-only coverage', (t) => withLedger(t, async (ctx) => {
  const { handle, context } = fileOp(t, ctx, { op: 'docs.author', owned: ['docs/'] });
  const inside = readCli(ctx, { handle, touch: [], name: 'inside.json' });
  assert.equal(inside.run.status, 0, inside.run.stderr || inside.run.stdout);
  assert.equal(judge(inside.digest, context), null);
  const outside = readCli(ctx, { handle: null, touch: ['docs/change.md'], name: 'outside.json' });
  assert.equal(outside.run.status, 0, outside.run.stderr || outside.run.stdout);
  assert.equal(judge(outside.digest, context)?.code, 'op-read-digest-no-knowledge', 'no op context: the generator cannot know the filed set');
  assert.ok(outside.digest.files.length < inside.digest.files.length);
  assert.equal(readCli(ctx, { handle: null, touch: [], name: 'none.json' }).run.status, 2, 'no op context and nothing to read is a usage error');
}));
