import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const skillRoot = path.resolve(import.meta.dirname, '..', '..');
const checkerFile = path.join(skillRoot, 'scripts', 'checks', 'check-json-exceptions.mjs');

// Agent launches write provider-local project settings into their own worktree through
// scripts/agent/trust.mjs projectTargets: .claude/settings.local.json (Claude) and
// .devin/config.local.json (Devin); the third target .codex/config.toml is not JSON and never
// reaches this checker. Each is git-ignored local state — wrongly blocked when a launch worktree is
// scanned (the land scratch failure this guards). A same-named file at any other path stays authored.
test('launch-trust project files at the root are local state wrongly blocked when flagged; nested lookalikes stay authored', async t => {
  const { checkJsonExceptions } = await import(pathToFileURL(checkerFile).href);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-json-trust-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'modules', 'kernel'), { recursive: true });
  const allowlist = path.join(dir, 'modules', 'kernel', 'allowlist.yaml');
  fs.writeFileSync(allowlist, 'schema: starci/allowlist@1\njson-exceptions:\n  exceptions: []\n');
  const local = ['.claude/settings.local.json', '.devin/config.local.json'];
  const authored = [
    'packages/app/.claude/settings.local.json',
    'packages/app/.devin/config.local.json',
    'packages/app/settings.local.json',
    'unexpected.json',
  ];
  for (const rel of [...local, ...authored]) {
    const file = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{}\n');
  }
  const result = checkJsonExceptions({ root: dir, allowlistFile: allowlist });
  assert.deepEqual([...result.offenders].sort(), [...authored].sort(),
    'only the exact root trust files are local; a nested lookalike stays authored');
  assert.equal(result.ok, false, 'authored JSON still fails the checker');
});

// A spec that scaffolds an app inside the checkout (hfs-scaffold-app.spec: .tmp-hfs-fe-build-*) runs beside specs whose docs gate scans
// the same root: the git-ignored scratch trees at the root are not authored JSON. The same names nested anywhere else stay authored.
test('git-ignored spec scratch trees at the root are skipped; the same names nested stay authored', async t => {
  const { checkJsonExceptions } = await import(pathToFileURL(checkerFile).href);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-json-scratch-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'modules', 'kernel'), { recursive: true });
  const allowlist = path.join(dir, 'modules', 'kernel', 'allowlist.yaml');
  fs.writeFileSync(allowlist, 'schema: starci/allowlist@1\njson-exceptions:\n  exceptions: []\n');
  const scratch = ['.tmp-hfs-fe-build-AbC123/demo/package.json', '.starci-wk-spec-x/state.json'];
  const authored = ['packages/.tmp-hfs-fe-build-AbC123/package.json'];
  for (const rel of [...scratch, ...authored]) {
    const file = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{}\n');
  }
  const result = checkJsonExceptions({ root: dir, allowlistFile: allowlist });
  assert.deepEqual([...result.offenders].sort(), authored, 'only the exact root scratch prefixes are skipped');
});

test('build caches of an example app (.turbo) are build output, not authored JSON', async t => {
  const { checkJsonExceptions } = await import(pathToFileURL(checkerFile).href);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-json-turbo-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'modules', 'kernel'), { recursive: true });
  const allowlist = path.join(dir, 'modules', 'kernel', 'allowlist.yaml');
  fs.writeFileSync(allowlist, 'schema: starci/allowlist@1\njson-exceptions:\n  exceptions: []\n');
  for (const rel of ['examples/app/.turbo/cache/abc-meta.json', 'examples/app/authored.json']) {
    const file = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{}\n');
  }
  const result = checkJsonExceptions({ root: dir, allowlistFile: allowlist });
  assert.deepEqual([...result.offenders], ['examples/app/authored.json'], 'the turbo cache is skipped, authored JSON beside it is not');
});
