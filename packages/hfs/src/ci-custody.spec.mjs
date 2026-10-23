// proves: CI_SECRET_SEALED@lite
// proves: CI_SECRET_SEALED@full
// proves: APP_SECRET_IN_CI@lite
// proves: APP_SECRET_IN_CI@full
// proves: CI_DECLARATION_DRIFT@lite
// proves: CI_DECLARATION_DRIFT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ciCustodyFindings } from '../runtime/scripts/hfs/rules/ci-custody.mjs';
import { mkdtemp } from './helpers/tmpdir.mjs';

const SEALED_FAILURE = 'CI_SECRET_SEALED';
const RUNTIME_FAILURE = 'APP_SECRET_IN_CI';
const DRIFT_FAILURE = 'CI_DECLARATION_DRIFT';
const workflow = (reads) => `name: ci\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n        env:\n          A: \${{ ${reads} }}\n`;
const sealedMember = (keys) => keys.map((key) => `${key}=ENC[AES256_GCM,data:abc,type:str]`).join('\n') + '\nsops_version=3.9.0\n';
const GRANT = { service: 'api', from: [{ member: 'api', keys: ['DB_PASSWORD'] }] };
const declaration = (ci, extra = {}) => ({ ci, environments: { production: { deploy: { secrets: { grants: [GRANT] } } } }, ...extra });
// The declaration is written as flow-style YAML (JSON is a YAML subset), so no hand indentation is needed.
const tree = (t, { doc, workflows = {}, sealed = { 'production/secrets/api.enc': ['DB_PASSWORD'] } }) => {
  const root = mkdtemp(t, 'hfs-ci-custody-');
  const put = (file, content) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), content); };
  put('.starcistacks/application-stacks.yaml', JSON.stringify(doc, null, 2) + '\n');
  for (const [file, keys] of Object.entries(sealed)) put(`.starcistacks/${file}`, sealedMember(keys));
  for (const [name, text] of Object.entries(workflows)) put(`.github/workflows/${name}`, text);
  return root;
};
const run = (root, edition) => ciCustodyFindings({ repoRoot: root, repo: { kind: 'app', edition }, isRoot: true });
const codes = (findings) => findings.map((finding) => finding.code);
const cleanCi = { secrets: [{ name: 'DEPLOY_TOKEN', scope: 'repository' }], vars: [] };

for (const edition of ['lite', 'full']) {
  test(`${edition}: a conforming tree with a separate CI secret and sealed app key is clean of custody findings`, (t) => {
    const root = tree(t, { doc: declaration(cleanCi), workflows: { 'ci.yml': workflow('secrets.DEPLOY_TOKEN') } });
    assert.deepEqual(run(root, edition), []);
  });

  test(`${edition}: ${SEALED_FAILURE} violation - a CI secret that is also a sealed member key is refused`, (t) => {
    const doc = declaration({ secrets: [{ name: 'DB_PASSWORD', scope: 'repository' }], vars: [] });
    const found = run(tree(t, { doc, workflows: { 'ci.yml': workflow('secrets.DB_PASSWORD') } }), edition);
    assert.ok(codes(found).includes(SEALED_FAILURE));
    assert.ok(found.find((finding) => finding.code === SEALED_FAILURE).path.endsWith('production/secrets/api.enc'));
  });

  test(`${edition}: ${SEALED_FAILURE} valid - a CI secret whose name is not a sealed key passes`, (t) => {
    const doc = declaration({ secrets: [{ name: 'DEPLOY_TOKEN', scope: 'repository' }], vars: [] });
    const found = run(tree(t, { doc, workflows: { 'ci.yml': workflow('secrets.DEPLOY_TOKEN') } }), edition);
    assert.ok(!codes(found).includes(SEALED_FAILURE));
  });

  test(`${edition}: ${RUNTIME_FAILURE} violation - a granted sealed key declared as a CI var is rejected`, (t) => {
    const doc = declaration({ secrets: [], vars: [{ name: 'DB_PASSWORD', scope: 'repository', value: 'x', optional: true }] });
    assert.ok(codes(run(tree(t, { doc }), edition)).includes(RUNTIME_FAILURE));
  });

  test(`${edition}: ${RUNTIME_FAILURE} passing - a sealed key the grant does not select may share a CI name`, (t) => {
    const doc = declaration({ secrets: [], vars: [{ name: 'OTHER_KEY', scope: 'repository', value: 'x', optional: true }] });
    const found = run(tree(t, { doc, sealed: { 'production/secrets/api.enc': ['DB_PASSWORD', 'OTHER_KEY'] } }), edition);
    assert.ok(!codes(found).includes(RUNTIME_FAILURE));
  });

  test(`${edition}: ${DRIFT_FAILURE} violation - an undeclared workflow read is refused`, (t) => {
    const text = workflow('secrets.DEPLOY_TOKEN') + '      - run: echo ${{ secrets.UNDECLARED_KEY }}\n';
    const found = run(tree(t, { doc: declaration(cleanCi), workflows: { 'ci.yml': text } }), edition);
    assert.ok(found.some((finding) => finding.code === DRIFT_FAILURE && finding.message.includes('UNDECLARED_KEY')));
  });

  test(`${edition}: ${DRIFT_FAILURE} negative - a non-optional declaration no workflow reads is rejected`, (t) => {
    const found = run(tree(t, { doc: declaration(cleanCi), workflows: { 'ci.yml': workflow('github.sha') } }), edition);
    assert.ok(found.some((finding) => finding.code === DRIFT_FAILURE && finding.message.includes('DEPLOY_TOKEN')));
  });

  test(`${edition}: ${DRIFT_FAILURE} fail - a service token binding naming an undeclared secret is flagged`, (t) => {
    const doc = declaration(cleanCi, { services: { sonar: { ci: { token: 'SONAR_TOKEN' } } } });
    const found = run(tree(t, { doc, workflows: { 'ci.yml': workflow('secrets.DEPLOY_TOKEN') } }), edition);
    assert.ok(found.some((finding) => finding.code === DRIFT_FAILURE && finding.message.includes('SONAR_TOKEN')));
  });

  test(`${edition}: ${DRIFT_FAILURE} valid - automatic GITHUB_TOKEN and optional declarations stay quiet`, (t) => {
    const doc = declaration({ secrets: [{ name: 'DEPLOY_TOKEN', scope: 'repository', optional: true }], vars: [] });
    assert.deepEqual(run(tree(t, { doc, workflows: { 'ci.yml': workflow('secrets.GITHUB_TOKEN') } }), edition), []);
  });
}
