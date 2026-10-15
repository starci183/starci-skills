import test from 'node:test';
import assert from 'node:assert/strict';
import { stackContext, tool, toolOutput, firstLine, lines } from '../../packages/hfs/stack/context.mjs';
import { EXIT, StackError, approvalMissing, failure, refusal } from '../../packages/hfs/stack/errors.mjs';

test('the exit codes and the three error constructors agree', () => {
  assert.deepEqual(EXIT, { ok: 0, failed: 1, refused: 2, approval: 3 });
  const base = new StackError('STACK_X', 'message');
  assert.equal(base.message, 'STACK_X: message');
  assert.equal(base.name, 'StackError');
  assert.equal(base.exit, EXIT.refused);
  assert.equal(failure('A', 'b').exit, EXIT.failed);
  assert.equal(refusal('A', 'b').exit, EXIT.refused);
  assert.equal(approvalMissing('A', 'b').exit, EXIT.approval);
  assert.equal(refusal('A', 'b').code, 'A');
});

test('the default context uses the process, the real clock and a lazily created sops seam', async () => {
  const ctx = stackContext();
  assert.equal(ctx.cwd, process.cwd());
  assert.equal(ctx.env, process.env);
  assert.equal(typeof ctx.now(), 'number');
  assert.equal(typeof ctx.fetch, 'function');
  await ctx.sleep(1);
  assert.ok(Object.isFrozen(ctx));
  const written = [];
  const real = { out: process.stdout.write, err: process.stderr.write };
  process.stdout.write = (text) => { written.push(['out', text]); return true; };
  process.stderr.write = (text) => { written.push(['err', text]); return true; };
  try { ctx.stdout('a'); ctx.stderr('b'); } finally { process.stdout.write = real.out; process.stderr.write = real.err; }
  assert.deepEqual(written, [['out', 'a'], ['err', 'b']]);
});

test('sops is created on first use from the app tools and cached; an injected seam is used as is', () => {
  const injected = { decrypt: () => ({}) };
  assert.equal(stackContext({ sops: injected }).sops, injected);
  const ctx = stackContext({ env: { PATH: '', Path: '' }, cwd: process.cwd() });
  assert.throws(() => ctx.sops, /sops|age/iu);
});

test('every seam can be replaced', async () => {
  const spawn = () => ({ status: 0, stdout: 'x', stderr: '' });
  const ctx = stackContext({ cwd: '/app', env: { A: '1' }, spawn, sleep: async () => 'slept', now: () => 7, stdout: () => 'o', stderr: () => 'e', fetch: () => 'f' });
  assert.equal(ctx.cwd, '/app');
  assert.equal(tool(ctx, 'docker', ['ps']).stdout, 'x');
  assert.equal(await ctx.sleep(5), 'slept');
  assert.equal(ctx.now(), 7);
  assert.equal(ctx.fetch(), 'f');
});

test('the real spawn runs a program without a shell and reports status, output and a missing program', () => {
  const ctx = stackContext();
  const ok = tool(ctx, process.execPath, ['-e', 'process.stdout.write(process.argv[1] + require("fs").readFileSync(0, "utf8"))', 'A$B'], { input: 'in' });
  assert.deepEqual([ok.status, ok.stdout, ok.stderr], [0, 'A$Bin', '']);
  const failed = tool(ctx, process.execPath, ['-e', 'process.stderr.write("oops"); process.exit(3)']);
  assert.deepEqual([failed.status, failed.stderr], [3, 'oops']);
  const missing = tool(ctx, 'starci-no-such-tool', []);
  assert.equal(missing.status, null);
  assert.ok(missing.error);
  assert.equal(missing.stdout, '');
});

test('toolOutput returns stdout, and throws the first stderr line or the spawn error', () => {
  const good = stackContext({ spawn: () => ({ status: 0, stdout: 'out\n', stderr: '' }) });
  assert.equal(toolOutput(good, 'docker', ['info']), 'out\n');
  const failed = stackContext({ spawn: () => ({ status: 1, stdout: '', stderr: 'first\nsecond' }) });
  assert.throws(() => toolOutput(failed, 'docker', ['service', 'ls', 'x']), /docker service ls: first$/u);
  const broken = stackContext({ spawn: () => ({ status: null, stdout: '', stderr: '', error: new Error('ENOENT') }) });
  assert.throws(() => toolOutput(broken, 'docker', []), /cannot run docker \(ENOENT\)/u);
});

test('firstLine and lines tolerate CRLF, blanks and missing text', () => {
  assert.equal(firstLine('  a\r\nb'), 'a');
  assert.equal(firstLine(undefined), '');
  assert.deepEqual(lines('a\r\n\r\nb\n'), ['a', 'b']);
  assert.deepEqual(lines(undefined), []);
});
