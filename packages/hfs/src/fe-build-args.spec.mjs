// proves: FE_PUBLIC_BUILD_ARG_MISSING@lite
// proves: FE_PUBLIC_BUILD_ARG_MISSING@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { feBuildArgsFindings, FE_PUBLIC_BUILD_ARG_MISSING } from '../runtime/scripts/hfs/rules/fe-build-args.mjs';
import { mkdtemp } from './helpers/tmpdir.mjs';

const FAILURE = 'FE_PUBLIC_BUILD_ARG_MISSING';
const SOURCE = "export const api = process.env.NEXT_PUBLIC_API_URL;\nexport const mode = process.env.NEXT_PUBLIC_MODE ?? 'dev';\n";
const DOCKERFILE = 'FROM node:22\nARG NEXT_PUBLIC_BASE=/\nRUN npm run build\n';
const declaration = (buildArgs) => `environments:\n  production:\n    deploy:\n      images:\n        web:\n          app: web\n${buildArgs}`;
const tree = (t, { dockerfile = DOCKERFILE, buildArgs = '' }) => {
  const root = mkdtemp(t, 'hfs-fe-build-args-');
  const files = { 'fe/apps/web/Dockerfile': dockerfile, 'fe/apps/web/src/env.ts': SOURCE, '.starcistacks/application-stacks.yaml': declaration(buildArgs) };
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return { root, files: Object.keys(files) };
};
const repoOf = (edition) => ({ kind: 'app', edition, sides: { fe: { apps: [{ name: 'web' }] } } });
const run = ({ root, files }, edition, isRoot = true) => feBuildArgsFindings({ repoRoot: root, files, repo: repoOf(edition), isRoot });

test('the exported code constant names the rule failure', () => assert.equal(FE_PUBLIC_BUILD_ARG_MISSING, FAILURE));

for (const edition of ['lite', 'full']) {
  test(`${edition}: ${FAILURE} violation - a required NEXT_PUBLIC name with no ARG default and no buildArgs is refused`, (t) => {
    const found = run(tree(t, {}), edition);
    assert.equal(found.length, 1);
    assert.equal(found[0].code, FAILURE);
    assert.equal(found[0].path, 'fe/apps/web/Dockerfile');
    assert.deepEqual(found[0].missing, [{ environment: 'production', names: ['NEXT_PUBLIC_API_URL'] }]);
  });

  test(`${edition}: valid - buildArgs values or sealed keys supply the required name and the fallback read is optional`, (t) => {
    assert.deepEqual(run(tree(t, { buildArgs: '          buildArgs:\n            values:\n              NEXT_PUBLIC_API_URL: https://api.example.com\n' }), edition), []);
    assert.deepEqual(run(tree(t, { buildArgs: '          buildArgs:\n            sealed:\n              keys: [NEXT_PUBLIC_API_URL]\n' }), edition), []);
  });

  test(`${edition}: valid - a Dockerfile ARG default supplies the name`, (t) => {
    const dockerfile = DOCKERFILE + 'ARG NEXT_PUBLIC_API_URL=https://api.example.com\n';
    assert.deepEqual(run(tree(t, { dockerfile }), edition), []);
  });

  test(`${edition}: ${FAILURE} negative - a missing Dockerfile or a non-root is not judged`, (t) => {
    const built = tree(t, {});
    assert.deepEqual(run(built, edition, false), []);
    const without = built.files.filter((file) => !file.endsWith('Dockerfile'));
    assert.deepEqual(run({ root: built.root, files: without }, edition), []);
  });
}
