// Replay of the first deploy through the affected gate (2026-10-09, registry: deploy-affected-gate-refuses-without-saying-why): `starci runtime deploy` ran the affected
// specs of the source clone for 19 minutes and refused "no receipt came back", naming no file. The sequence here is the gate's own: the REAL `starci test affected --run`
// verb is started by the deploy's production child runner in a real git repository whose change has one green and (second case) one red spec, writes its receipt FILE, and the
// judgement names what happened. Real: the verb, its selection, its spec processes, the child runner. Stubbed: nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runAffectedChild, affectedJudgement, provenFor } from '../../scripts/reconciler/runtime-deploy-affected.mjs';
import { makeTempDir } from '../../scripts/api/fs/make-temp-dir.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';

const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };

/** A small repository with the four spec preloads of the runtime, one module and its specs; `redSpec` adds a spec that fails after the change. */
function repository(t, { redSpec }) {
  const dir = makeTempDir('starci-replay-affected-');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }));
  git(dir, 'init', '-q', '-b', 'main');
  for (const name of ['low-priority', 'isolated-temp', 'isolated-registry', 'runtime-copies']) write(dir, `tests/setup/${name}.mjs`, '');
  for (const source of ['engine', 'packages', 'ui', 'ext', 'init']) write(dir, `${source}/keep.mjs`, 'export const keep = 0;\n');
  write(dir, 'package.json', '{"name":"replay-affected","type":"module"}\n');
  write(dir, 'scripts/answer.mjs', 'export const answer = () => 1;\n');
  const expected = redSpec ? 'answer() === 1' : 'answer() >= 1';
  write(dir, 'tests/answer.spec.mjs', `import test from 'node:test';
import assert from 'node:assert/strict';
import { answer } from '../scripts/answer.mjs';
test('answer', () => assert.ok(${expected}));
`);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'base');
  const base = git(dir, 'rev-parse', 'HEAD');
  write(dir, 'scripts/answer.mjs', 'export const answer = () => 2;\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'change the answer');
  return { dir, base, tip: git(dir, 'rev-parse', 'HEAD') };
}

// The spec processes must not inherit the runner of this very test (NODE_TEST_CONTEXT makes a nested `node --test` report to its parent and exit 0 whatever it saw).
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT'));

// The production child runner, pointed at the runtime's real CLI, run against the repository (--root): the deploy starts it in the source clone itself.
const runVerb = (repo) => runAffectedChild({ dir: repo.dir, base: repo.base, env: cleanEnv(), budgetMs: 240_000, marginMs: 60_000, pollMs: 100,
  cli: path.join(skillRoot, 'packages', 'cli', 'bin', 'starci.mjs'), extraArgs: ['--root', repo.dir], runtime: skillRoot });

test('a clean affected run leaves its receipt as a file the deploy judges, and the pair is then proven for the next deploy', async (t) => {
  const repo = repository(t, { redSpec: false });
  const result = await runVerb(repo);
  assert.equal(result.exit.code, 0, JSON.stringify(result.tail));
  assert.ok(result.receipt, 'the receipt came back as a file, not out of the output');
  assert.deepEqual(affectedJudgement(result, { sha: repo.tip, base: repo.base }), { affected: { base: repo.base, tip: repo.tip, passed: 1, total: 1 } });
  assert.ok(provenFor({ dir: repo.dir, base: repo.base, tip: repo.tip }), 'a clean run leaves the proven receipt of its pair');
});

test('a red spec is named in the refusal, with no proven receipt left behind', async (t) => {
  const repo = repository(t, { redSpec: true });
  const result = await runVerb(repo);
  assert.equal(result.exit.code, 1);
  assert.deepEqual(result.red, ['tests/answer.spec.mjs']);
  assert.match(affectedJudgement(result, { sha: repo.tip, base: repo.base }).detail, /1 spec file\(s\) are red: tests\/answer\.spec\.mjs/);
  assert.equal(provenFor({ dir: repo.dir, base: repo.base, tip: repo.tip }), null);
});
