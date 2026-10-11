// The affected-spec gate of `starci runtime deploy` against REAL child processes: the spawn is the production one (files for stdout and stderr, a receipt file, a timeout of the
// declared budget plus a margin); only the CLI it starts is a small script standing in for `starci test affected`, so each ending of the run can be produced and judged.
// The first real deploy through this gate was refused after 19 minutes with "no receipt came back" and the text of 479 PASS lines: nothing in it said what had happened.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runAffectedChild, affectedJudgement, provenFor } from '../../scripts/reconciler/runtime-deploy-affected.mjs';
import { leaveReceipts, provenReceiptFile, readReceiptFile } from '../../scripts/supervisor/affected-receipt-file.mjs';
import { makeTempDir } from '../../scripts/api/fs/make-temp-dir.mjs';

const BASE = 'b'.repeat(40);
const TIP = 't'.repeat(40);

/** A source clone directory and a stand-in `starci` that behaves as `mode` says. */
function clone(t, script) {
  const dir = makeTempDir('starci-affected-clone-');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 }));
  const cli = path.join(dir, 'stand-in.mjs');
  fs.writeFileSync(cli, script);
  return { dir, cli };
}

/** The stand-in: reads --receipt-file, prints `lines` progress lines on stderr, writes `receipt` to the file and `answer` on stdout, then exits `code` (or sleeps / kills itself). */
const standIn = ({ lines = 3, receipt = null, answer = {}, code = 0, bytes = 0, sleepMs = 0, die = null }) => `
import fs from 'node:fs';
const args = process.argv.slice(2);
const file = args[args.indexOf('--receipt-file') + 1];
for (let i = 0; i < ${lines}; i += 1) process.stderr.write('PASS tests/x' + i + '.spec.mjs (0.1s)\\n');
if (${sleepMs}) await new Promise((resolve) => setTimeout(resolve, ${sleepMs}));
${receipt ? `fs.writeFileSync(file, JSON.stringify(${JSON.stringify(receipt)}));` : ''}
process.stdout.write(JSON.stringify({ ...${JSON.stringify(answer)}, padding: 'x'.repeat(${bytes}) }));
${die ? `process.kill(process.pid, '${die}'); await new Promise((resolve) => setTimeout(resolve, 5000));` : ''}
process.exit(${code});
`;

const receipt = (over = {}) => ({ schema: 'starci/affected-receipt@1', base: BASE, tip: TIP, clean: true, files: 3, passed: 3, total: 3, ok: true, ms: 10, budgetMs: 60_000, concurrency: 2, ...over });
const run = (c, over = {}) => runAffectedChild({ dir: c.dir, base: BASE, env: process.env, budgetMs: 20_000, marginMs: 20_000, pollMs: 20, cli: c.cli, ...over });
const judge = (result) => affectedJudgement(result, { sha: TIP, base: BASE });

test('green: the child writes its receipt file, its progress is relayed while it runs, and an answer far past a pipe buffer is no problem', async (t) => {
  const c = clone(t, standIn({ lines: 5, receipt: receipt(), answer: { ok: true }, bytes: 3_000_000 }));
  const seen = [];
  const result = await run(c, { progress: (line) => seen.push(line) });
  assert.equal(result.exit.code, 0);
  assert.ok(seen.filter((line) => line.startsWith('affected: PASS tests/x')).length === 5, `progress is printed while it runs: ${seen.length} lines`);
  assert.deepEqual(judge(result), { affected: { base: BASE, tip: TIP, passed: 3, total: 3 } });
});

test('red files are named, with the receipt that says so', async (t) => {
  const answer = { ok: false, results: [{ file: 'tests/a.spec.mjs', pass: true }, { file: 'tests/b.spec.mjs', pass: false }, { file: 'tests/c.spec.mjs', pass: false }] };
  const result = await run(clone(t, standIn({ receipt: receipt({ ok: false, passed: 1 }), answer, code: 1 })));
  assert.match(judge(result).detail, /2 spec file\(s\) are red: tests\/b\.spec\.mjs, tests\/c\.spec\.mjs/);
});

test('a budget that ended names the files that were not started (exit 2)', async (t) => {
  const answer = { ok: false, results: [{ file: 'tests/a.spec.mjs', pass: true }, { file: 'tests/late.spec.mjs', pass: false, skipped: true }] };
  const result = await run(clone(t, standIn({ receipt: receipt({ ok: false, passed: 1, total: 2, files: 2 }), answer, code: 2 })));
  assert.match(judge(result).detail, /time budget ended with 1 spec file\(s\) not started: tests\/late\.spec\.mjs/);
});

test('a child that died names how (exit code, or the signal) and its last lines', async (t) => {
  const exited = await run(clone(t, standIn({ lines: 2, code: 7 })));
  const byExit = judge(exited).detail;
  assert.match(byExit, /wrote no receipt: the child exited 7/);
  assert.match(byExit, /Last lines: PASS tests\/x0\.spec\.mjs \(0\.1s\) \| PASS tests\/x1\.spec\.mjs/);
  if (process.platform !== 'win32') {
    const killed = await run(clone(t, standIn({ lines: 1, die: 'SIGKILL' })));
    assert.match(judge(killed).detail, /ended by SIGKILL/);
  }
});

test('a child that outlives the budget plus margin is stopped and said so', async (t) => {
  const c = clone(t, standIn({ receipt: receipt(), sleepMs: 60_000 }));
  const result = await run(c, { budgetMs: 300, marginMs: 300 });
  assert.equal(result.exit.timedOut, true);
  assert.match(judge(result).detail, /did not finish inside its budget plus margin and was stopped/);
});

test('a receipt for another tip, another base, an unclean tree or a partial pass is refused with its own words', async (t) => {
  const cases = [
    [{ tip: 'e'.repeat(40) }, /receipt is for tip eeeeeeeeeeee/],
    [{ base: 'a'.repeat(40) }, /against base aaaaaaaaaaaa/],
    [{ clean: false }, /source tree was not clean/],
    [{ ok: false, passed: 2 }, /not ok: 2 of 3 of 3 selected files passed/],
  ];
  for (const [over, detail] of cases) {
    const result = await run(clone(t, standIn({ receipt: receipt(over) })));
    assert.match(judge(result).detail, detail);
  }
});

test('the verb leaves the receipt as a file the caller named and as the proven receipt of its pair; a red run leaves only the first', (t) => {
  const root = makeTempDir('starci-affected-root-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 }));
  const requested = path.join(root, 'out', 'receipt.json');
  const refs = leaveReceipts({ root, receipt: receipt(), requested });
  assert.equal(refs.receiptFile, path.resolve(requested));
  assert.deepEqual(readReceiptFile(requested), receipt());
  assert.deepEqual(readReceiptFile(provenReceiptFile(root, BASE, TIP)), receipt());
  assert.deepEqual(provenFor({ dir: root, base: BASE, tip: TIP }), receipt(), 'the pair already proven is accepted');
  assert.equal(provenFor({ dir: root, base: 'a'.repeat(40), tip: TIP }), null, 'another base is another pair');
  const red = leaveReceipts({ root, receipt: receipt({ ok: false, passed: 2, tip: 'r'.repeat(40) }), requested });
  assert.equal(red.provenFile, undefined);
  assert.equal(provenFor({ dir: root, base: BASE, tip: 'r'.repeat(40) }), null);
});
