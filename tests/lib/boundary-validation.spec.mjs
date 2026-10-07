import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { containedPath } from '../../scripts/lib/path-key.mjs';
import { logLine, textLine } from '../../scripts/lib/escape.mjs';
import { verbCli } from '../../scripts/lib/cli-arg.mjs';
import { renderReportBlock } from '../../scripts/kernel/report-render.mjs';
import { hasFlag } from '../../scripts/lib/ts-ast.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const node = (args, options = {}) => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', ...options });

test('containedPath returns a path under its base and refuses dot segments, absolute escapes and links out', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-contained-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-contained-out-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'a'));
  assert.equal(path.relative(dir, containedPath(dir, 'a')), 'a');
  assert.equal(path.relative(dir, containedPath(dir, 'a/not-yet/created')), path.join('a', 'not-yet', 'created'));
  assert.equal(path.relative(dir, containedPath(dir, dir)), '', 'the base itself is inside');
  for (const bad of ['..', '../x', 'a/../../x', outside, path.join(dir, '..', 'elsewhere'), `${dir}-sibling`]) {
    assert.throws(() => containedPath(dir, bad), { code: 'PATH_OUTSIDE_BASE' }, bad);
  }
  fs.symlinkSync(outside, path.join(dir, 'link'), 'junction');
  assert.throws(() => containedPath(dir, 'link/file.txt'), { code: 'PATH_OUTSIDE_BASE' }, 'a link leading out');
});

test('logLine prints well-formed data byte-identically to JSON.stringify and keeps hostile text on one line', () => {
  for (const value of [{ ok: true, n: 1 }, { text: 'a\nb\r\nc\t\u0000d "q" \\ \u00e9 \u{1F600}' }, ['x', null], 'plain', 5, null]) {
    assert.equal(logLine(value), JSON.stringify(value));
  }
  const hostile = logLine({ text: 'x y z', key: 'k\u001b[2J' });
  assert.equal(hostile, '{"text":"x\\u2028y\\u2029z","key":"k\\u001b[2J"}');
  assert.equal(logLine({ 'line\nbreak': 1 }).includes('\n'), false);
  assert.equal(logLine(undefined), 'undefined');
});

test('verbCli print keeps legitimate output and never lets a value forge a log line', (t) => {
  const printed = [];
  t.mock.method(console, 'log', (text) => printed.push(text));
  const { print } = verbCli(['list']);
  print({ ok: true }, 'plain "quoted" back\\slash\ttab');
  print({ ok: true }, ['first', 'second line']);
  print({ ok: true }, []);
  assert.deepEqual(printed, ['plain "quoted" back\\slash\ttab', 'first\nsecond line', '']);
  printed.length = 0;
  print({ ok: true }, `title \r\nFORGED line\u001b[2J`);
  print({ ok: true }, ['row \r\nFORGED', 'next']);
  assert.deepEqual(printed, ['title \\u000d\\u000aFORGED line\\u001b[2J', 'row \\u000d\\u000aFORGED\nnext']);
  printed.length = 0;
  verbCli(['list', '--json']).print({ ok: true, text: 'a\r\nb' }, 'ignored');
  assert.deepEqual(printed, ['{"ok":true,"text":"a\\r\\nb"}']);
});

test('textLine writes every control character but the tab visibly and leaves ordinary text alone', () => {
  assert.equal(textLine('a\r\nb c\u007fd\te'), 'a\\u000d\\u000ab\\u2028c\u007fd\te');
  assert.equal(textLine(null), '');
  assert.equal(textLine('plain "q" \\ é \u{1F600}'), 'plain "q" \\ é \u{1F600}');
});

test('the report block never carries a secret from the report', () => {
  const token = `ghp_${'a1B2c3D4e5'.repeat(4).slice(0, 36)}`;
  const block = renderReportBlock({ task: 't', dispatch: 'd', outcome: 'done', summary: `pushed with ${token}`, open: ['API_KEY=hunter2hunter2'], blocker: { kind: 'x', detail: `Bearer ${token}` } });
  assert.equal(block.includes(token), false);
  assert.equal(block.includes('hunter2hunter2'), false);
  assert.match(block, /=== OP REPORT — t \/ d ===/);
  assert.match(block, /outcome : done/);
});

test('hasFlag reads one bit as arithmetic', () => {
  assert.equal(hasFlag(0b0110, 0b0010), true);
  assert.equal(hasFlag(0b0110, 0b0001), false);
  assert.equal(hasFlag(0b0110, 0b1000), false);
  assert.equal(hasFlag(0, 2), false);
});

test('render-proof refuses a --work outside the runtime tree and the working directory', (t) => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-render-proof-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  for (const work of ['../../..', outside]) {
    const r = node(['scripts/work/render-proof.mjs', '--work', work, '--record', 'x']);
    assert.equal(r.status, 1, work);
    assert.match(r.stderr, /REFUSED --work .* is outside .*PATH_OUTSIDE_BASE/, work);
  }
});

test('check-example-yaml refuses a directory outside the runtime tree', () => {
  const r = node(['scripts/checks/check-example-yaml.mjs', '../../..']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /REFUSED directory .* is outside .*PATH_OUTSIDE_BASE/);
});

test('the canon-parity lint child refuses a job file outside the OS temp directory', () => {
  const r = node(['scripts/kernel/settle/canon-parity.mjs', '--lint-child', path.join(root, 'package.json')]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /PATH_OUTSIDE_BASE/);
});
