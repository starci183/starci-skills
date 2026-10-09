// Replay of the day the check was taken for the verdict (2026-10-09, registry: check-green-taken-as-verified): every lane and the lead reported "npm run check exit 0, N of N" as the proof a branch was fit to
// merge and deploy, 28 branches went onto the integration tip on that word, and the first run of the deploy gate's affected specs found 14 red spec files on it - the check never starts a spec.
// The sequence here: a commit whose check is green (as it was all day) and whose affected spec is red. `starci runtime verify` must not call it verified, no land and no deploy may take it, and the same
// commit with the spec fixed is verified and accepted by both. Real: the verify verb, the affected verb it starts as a child (its selection, its spec processes, its receipt file), the receipts, the land receipt
// lookup and the deploy receipt lookup. Stubbed: the runtime check (the replay repository holds no runtime to check; the check being green is the day's fact).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runtimeVerify } from '../../scripts/reconciler/runtime-verify.mjs';
import { runAffectedChild } from '../../scripts/reconciler/runtime-deploy-affected.mjs';
import { receiptFor } from '../../scripts/reconciler/runtime-deploy-receipt.mjs';
import { landVerifyReceipt } from '../../scripts/supervisor/git-land-receipt.mjs';
import { commit, git, loadFixture, replayWorld, write } from '../helpers/replay-world.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';

/** A repository on main with a module, its spec and the four preloads, and a lane commit that changes the module; the spec is red on that change when `redSpec`. */
function repository(t, { redSpec }) {
  const world = replayWorld(t, loadFixture('leg-ready'), {});
  const dir = path.join(world.base, 'verify-repo');
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  const files = { 'scripts/answer.mjs': 'export const answer = () => 1;\n', 'package.json': '{"name":"replay-verify","type":"module"}\n', '.gitignore': '.runtime/\n' };
  for (const name of ['low-priority', 'isolated-temp', 'isolated-registry', 'runtime-copies']) files[`tests/setup/${name}.mjs`] = '';
  for (const source of ['engine', 'packages']) files[`${source}/keep.mjs`] = 'export const keep = 0;\n';
  files['tests/answer.spec.mjs'] = [`import test from 'node:test';`, `import assert from 'node:assert/strict';`, `import { answer } from '../scripts/answer.mjs';`, `test('answer', () => assert.ok(answer() ${redSpec ? '===' : '>='} 1));`, ''].join('\n');
  for (const [rel, text] of Object.entries(files)) write(dir, rel, text);
  const base = commit(dir, 'the module and its spec');
  write(dir, 'scripts/answer.mjs', 'export const answer = () => 2;\n');
  const tip = commit(dir, 'change the answer');
  return { dir, base, tip, tree: git(dir, 'rev-parse', 'HEAD^{tree}'), env: Object.fromEntries(Object.entries(world.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT')) };
}

// The verify verb as a lane runs it: the check is green (stubbed), the affected specs run through the production child runner against the real CLI of this runtime.
const verify = (repo) => runtimeVerify({ args: { root: repo.dir, base: repo.base }, positionals: [], cwd: repo.dir, env: repo.env }, {
  progress: () => {},
  seams: {
    runCheck: () => ({ ok: true, pass: 2301, total: 2301, output: 'check: ok' }),
    runAffected: (dir, base, progress) => runAffectedChild({ dir, base, env: repo.env, budgetMs: 240_000, marginMs: 60_000, pollMs: 100, progress, cli: path.join(skillRoot, 'packages', 'cli', 'bin', 'starci.mjs'), runtime: skillRoot }),
  },
});
const deployAsks = (repo) => receiptFor({ sha: repo.tip, tree: repo.tree, base: repo.base, host: repo.dir, env: repo.env, dir: repo.dir });

test('a green check with a red spec is NOT VERIFIED: the line names the file, no receipt is left, and neither the land nor the deploy accepts the commit', async (t) => {
  const repo = repository(t, { redSpec: true });
  const out = await verify(repo);
  assert.equal(out.code, 1, out.text);
  assert.match(out.text.split('\n').at(-1), new RegExp(`^NOT VERIFIED ${repo.tip.slice(0, 12)}: 1 spec file\\(s\\) are red: tests/answer\\.spec\\.mjs \\[red: tests/answer\\.spec\\.mjs\\]$`));
  assert.equal(landVerifyReceipt({ worktree: repo.dir, tip: repo.tip, base: repo.base }).ok, false, 'the land refuses it');
  assert.equal(deployAsks(repo), null, 'the deploy takes no receipt for it');
});

test('the same commit with the spec fixed is verified once, and the land and the deploy both accept that one receipt', async (t) => {
  const repo = repository(t, { redSpec: false });
  const out = await verify(repo);
  assert.equal(out.code, 0, out.text);
  assert.equal(out.text.split('\n').at(-1), `verified ${repo.tip.slice(0, 12)}: check 2301/2301, affected 1/1 of ${repo.base.slice(0, 12)}..${repo.tip.slice(0, 12)}`);
  const landed = landVerifyReceipt({ worktree: repo.dir, tip: repo.tip, base: repo.base });
  assert.equal(landed.ok, true);
  assert.deepEqual([landed.record.check, landed.record.affected.passed, landed.record.affected.total], [{ pass: 2301, total: 2301 }, 1, 1]);
  assert.deepEqual(deployAsks(repo).affected, { base: repo.base, tip: repo.tip, passed: 1, total: 1 });
  const again = await verify(repo);
  assert.match(again.text.split('\n').at(-1), /^verified /, 'a second verification of the same pair accepts the proven affected receipt and the unchanged green file is reused');
});
