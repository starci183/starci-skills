import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { landCommits } from '../../scripts/supervisor/land.mjs';
import { preflightDrawGrammarDist } from '../../scripts/work/draw-render.mjs';
import { grammarFixture } from '../fixtures/grammar-dist.mjs';

const git = (dir, ...args) => {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};

test('landing a grammar source change rebuilds live main after fast forward', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grammar-land-'));
  const envRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'grammar-land-env-'));
  t.after(() => { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(envRoot, { recursive: true, force: true }); });
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Spec');
  git(root, 'config', 'user.email', 'spec@example.invalid');
  git(root, 'config', 'core.autocrlf', 'false');
  const src = path.join(root, 'packages', 'grammar', 'src', 'core', 'index.ts');
  fs.mkdirSync(path.dirname(src), { recursive: true });
  fs.writeFileSync(src, 'export const value = 1;\n');
  git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'base');
  const lane = path.join(envRoot, 'lane');
  git(root, 'worktree', 'add', '-q', '-b', 'change', lane, 'main');
  fs.writeFileSync(path.join(lane, 'packages', 'grammar', 'src', 'core', 'index.ts'), 'export const value = 2;\n');
  git(lane, 'add', '-A'); git(lane, 'commit', '-q', '-m', 'grammar source');
  const sha = git(lane, 'rev-parse', 'HEAD');
  const calls = [];
  const result = landCommits({ commits: [sha], root, push: false,
    env: { ...process.env, STARCI_LANES_ROOT: path.join(envRoot, 'lands') },
    deps: { runChecks: ({ dir, base, head }) => ({ ok: true, checks: [], changed: ['packages/grammar/src/core/index.ts'], rows: [['M', 'packages/grammar/src/core/index.ts']] }),
      rebuildGrammar: (args) => { calls.push(args); return { ok: true, state: 'fresh' }; } } });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].root, root);
  assert.equal(fs.readFileSync(src, 'utf8'), 'export const value = 2;\n');
  assert.equal(result.grammarRebuild?.ok, true);

  const lane2 = path.join(envRoot, 'lane2');
  git(root, 'worktree', 'add', '-q', '-b', 'version', lane2, 'main');
  const manifest = path.join(lane2, 'packages', 'grammar', 'package.json');
  fs.writeFileSync(manifest, '{"name":"@starci/grammar","version":"1.0.0"}\n');
  git(lane2, 'add', '-A'); git(lane2, 'commit', '-q', '-m', 'grammar version');
  const versionSha = git(lane2, 'rev-parse', 'HEAD');
  const failed = landCommits({ commits: [versionSha], root, push: false,
    env: { ...process.env, STARCI_LANES_ROOT: path.join(envRoot, 'lands') },
    deps: { runChecks: () => ({ ok: true, checks: [], changed: ['packages/grammar/package.json'], rows: [['A', 'packages/grammar/package.json']] }),
      rebuildGrammar: () => ({ ok: false, step: 'npm run build', detail: 'injected failure', owed: ['grammar-dist-rebuild'] }) } });
  assert.equal(failed.ok, true, 'a dist build failure cannot roll back a completed land');
  assert.equal(failed.grammarRebuild?.ok, false);
  assert.equal(git(root, 'rev-parse', 'main'), failed.landed);
});

test('draw preflight rejects an explicitly pinned stale grammar dist', (t) => {
  const grammar = grammarFixture(t);
  assert.equal(preflightDrawGrammarDist(grammar.root).state, 'fresh');
  grammar.write('src/core/index.ts', 'export const family = "changed"\n');
  assert.throws(() => preflightDrawGrammarDist(grammar.root), /dist.*stale|stale.*dist/i);
});
