// secret-tracked.spec.mjs - RT_SECRET_TRACKED (scripts/hfs/runtime-rules/secret-tracked.mjs): the public runtime repository tracks no sealed secret and no secret env file, except the paths
// ruleParams.runtime.heldSecrets names; and the real runtime holds nothing outside that list.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { byCodeUnit } from '../../scripts/lib/list.mjs';
import { RT_SECRET_TRACKED, secretTrackedFindings } from '../../scripts/hfs/runtime-rules/secret-tracked.mjs';
import { runtimeCheck } from '../../scripts/hfs/runtime-check.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { HELD_MEMBERS } from '../../scripts/gates/sonar-host-secrets.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const ctx = (files, heldSecrets = []) => ({ params: { heldSecrets }, files });

test('RT_SECRET_TRACKED: a tracked *.enc, secret.env or .env fails, wherever it lies, naming the way out', () => {
  const found = secretTrackedFindings(ctx(['ext/sonar/secrets/x.key.enc', 'secret.env', 'examples/app/.env', 'examples/app/.env.example', 'secret.env.example', 'scripts/a.mjs', 'examples/app/.starcistacks/dev/secrets/.gitkeep']));
  assert.deepEqual(found.map((f) => [f.code, f.path]), [[RT_SECRET_TRACKED, 'ext/sonar/secrets/x.key.enc'], [RT_SECRET_TRACKED, 'secret.env'], [RT_SECRET_TRACKED, 'examples/app/.env']]);
  assert.match(found[0].message, /untracked \.claude\/secret\.env.*rotating the secret/s);
  assert.equal(found.every((f) => f.level === 'error'), true);
});

test('RT_SECRET_TRACKED: a path ruleParams.runtime.heldSecrets names is allowed, only that path, and nothing else is', () => {
  const held = [{ path: 'ext/sonar/secrets/db.txt.enc', reason: 'the stack' }];
  assert.deepEqual(secretTrackedFindings(ctx(['ext/sonar/secrets/db.txt.enc'], held)), []);
  assert.deepEqual(secretTrackedFindings(ctx(['ext/sonar/secrets/other.txt.enc'], held)).map((f) => f.path), ['ext/sonar/secrets/other.txt.enc']);
});

test('RT_SECRET_TRACKED: git-tracked ciphertext and placeholder members fail in examples, templates and arbitrary directories', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-tracked-secret-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sealed = [
    'examples/lite-app/.starcistacks/production/secrets/app.enc',
    'examples/full-app/.starcistacks/dev/secrets/app.enc',
    'packages/hfs/templates/app/skeleton-lite/.starcistacks/dev/secrets/app.enc',
    'arbitrary/nested/placeholder.enc',
  ];
  const names = ['members.json', 'secret.env.example'];
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  for (const file of [...sealed, ...names]) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'synthetic non-secret fixture\n');
  }
  const git = (args) => {
    const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, 'fixture git command succeeds');
    return result.stdout;
  };
  git(['init', '--quiet']);
  git(['add', '--', ...sealed, ...names]);
  const files = git(['ls-files', '-z']).split('\0').filter(Boolean);
  const found = secretTrackedFindings(ctx(files));
  assert.deepEqual(found.map((finding) => finding.path).sort(byCodeUnit), [...sealed].sort(byCodeUnit));
  assert.ok(found.every((finding) => finding.code === RT_SECRET_TRACKED && finding.level === 'error'));
  assert.deepEqual(secretTrackedFindings(ctx(names)), []);
});

const heldSecretsOf = (node) => {
  if (node === null || typeof node !== 'object') return undefined;
  if (Object.hasOwn(node, 'heldSecrets')) return node.heldSecrets;
  return Object.values(node).map(heldSecretsOf).find((found) => found !== undefined);
};

test('RT_SECRET_TRACKED: the dated allowance is empty on the real tree, every old member is gone from it, and nothing tracked is sealed or an env file', () => {
  const manifest = parseYaml(fs.readFileSync(path.join(ROOT, 'knowledge', 'hfs', 'runtime-slots.yaml'), 'utf8'));
  assert.deepEqual(heldSecretsOf(manifest), [], 'ruleParams.runtime.heldSecrets is empty');
  for (const member of HELD_MEMBERS) assert.equal(fs.existsSync(path.join(ROOT, member.path)), false, `${member.path} is deleted from the tree`);
  assert.equal(fs.existsSync(path.join(ROOT, 'ext', 'sonar', 'secrets')), false, 'the Sonar extension holds no custody directory');
  const exampleSecrets = path.join(ROOT, 'examples', 'lite-app', '.starcistacks', 'production', 'secrets');
  assert.deepEqual(fs.readdirSync(exampleSecrets), ['.gitkeep'], 'the public example declares custody without holding secret material');
  const real = runtimeCheck({ repoRoot: ROOT, root: ROOT });
  assert.deepEqual(real.findings.filter((f) => f.code === RT_SECRET_TRACKED), [], 'the real tree trips no RT_SECRET_TRACKED with the empty allowance');
});

test('RT_SECRET_TRACKED: with an empty allowance a tracked old member fails, naming the way out', () => {
  const found = secretTrackedFindings(ctx(HELD_MEMBERS.map((member) => member.path), []));
  assert.equal(found.length, HELD_MEMBERS.length);
  assert.ok(found.every((f) => f.code === RT_SECRET_TRACKED && f.message.includes('untracked .claude/secret.env')));
});
