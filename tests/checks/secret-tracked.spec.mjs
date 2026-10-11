// secret-tracked.spec.mjs - RT_SECRET_TRACKED (scripts/hfs/runtime-rules/secret-tracked.mjs): the public runtime repository tracks no sealed secret and no secret env file, except the paths
// ruleParams.runtime.heldSecrets names; and the real runtime holds nothing outside that list.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
  const real = runtimeCheck({ repoRoot: ROOT, root: ROOT });
  assert.deepEqual(real.findings.filter((f) => f.code === RT_SECRET_TRACKED), [], 'the real tree trips no RT_SECRET_TRACKED with the empty allowance');
});

test('RT_SECRET_TRACKED: with an empty allowance a tracked old member fails, naming the way out', () => {
  const found = secretTrackedFindings(ctx(HELD_MEMBERS.map((member) => member.path), []));
  assert.equal(found.length, HELD_MEMBERS.length);
  assert.ok(found.every((f) => f.code === RT_SECRET_TRACKED && f.message.includes('untracked .claude/secret.env')));
});
