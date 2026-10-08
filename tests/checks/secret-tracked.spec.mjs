// secret-tracked.spec.mjs - RT_SECRET_TRACKED (scripts/hfs/runtime-rules/secret-tracked.mjs): the public runtime repository tracks no sealed secret and no secret env file, except the paths
// ruleParams.runtime.heldSecrets names; and the real runtime holds nothing outside that list.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { RT_SECRET_TRACKED, secretTrackedFindings } from '../../scripts/hfs/runtime-rules/secret-tracked.mjs';
import { runtimeCheck } from '../../scripts/hfs/runtime-check.mjs';

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

test('RT_SECRET_TRACKED: the runtime tree tracks no secret outside its declared held list, and the per-example Sonar tokens are gone', () => {
  const result = runtimeCheck({ repoRoot: ROOT, root: ROOT });
  assert.deepEqual(result.findings.filter((f) => f.code === RT_SECRET_TRACKED), []);
  for (const member of [...['lite-app', 'shape-slot', 'starci-ecommerce-app'].map((name) => `sonarqube-${name}-token.key.enc`), 'KEYS.md']) assert.equal(fs.existsSync(path.join(ROOT, 'ext', 'sonar', 'secrets', member)), false, member);
});
