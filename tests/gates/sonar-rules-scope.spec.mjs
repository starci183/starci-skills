import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { analysed, inScope, readSonarScope, scopeFiles } from '../../scripts/gates/sonar-rules-scope.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const put = (root, relative, text = '') => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

const PROPERTIES = [
  '# a comment',
  'sonar.sources=src,tool/run.mjs',
  'sonar.inclusions=**/*.mjs',
  'sonar.exclusions=**/*.spec.mjs,**/dist/**,src/generated.mjs',
  'sonar.tests=tests',
  '',
].join('\n');

test('the scope is read from sonar-project.properties: sources, inclusions, exclusions', (t) => {
  const root = mkdtemp(t, 'starci-sonar-scope-');
  assert.equal(readSonarScope(root), null, 'a checkout without the properties file has no scope');
  put(root, 'sonar-project.properties', PROPERTIES);
  assert.deepEqual(readSonarScope(root), { sources: ['src', 'tool/run.mjs'], inclusions: ['**/*.mjs'], exclusions: ['**/*.spec.mjs', '**/dist/**', 'src/generated.mjs'] });
});

test('scopeFiles lists the analysed files only, sorted, and analysed() agrees', (t) => {
  const root = mkdtemp(t, 'starci-sonar-scope-');
  put(root, 'sonar-project.properties', PROPERTIES);
  for (const file of ['src/b.mjs', 'src/a.mjs', 'src/a.spec.mjs', 'src/generated.mjs', 'src/readme.md', 'src/dist/x.mjs', 'src/node_modules/m/i.mjs', 'tool/run.mjs', 'tool/other.mjs', 'tests/t.mjs']) put(root, file, 'export const x = 1;\n');
  const scope = readSonarScope(root);
  const files = scopeFiles(root, scope);
  assert.deepEqual(files, ['src/a.mjs', 'src/b.mjs', 'tool/run.mjs']);
  for (const file of files) assert.ok(analysed(file, scope), file);
  for (const file of ['src/a.spec.mjs', 'src/generated.mjs', 'tool/other.mjs', 'tests/t.mjs', 'src/dist/x.mjs']) assert.ok(!analysed(file, scope), file);
  assert.ok(inScope('src/a.mjs', scope) && !inScope('src/a.spec.mjs', scope));
});

test('the scope of this runtime is the one SonarCloud reads', () => {
  const root = path.resolve(import.meta.dirname, '..', '..');
  const files = scopeFiles(root);
  assert.ok(files.length > 500);
  assert.ok(files.includes('scripts/checks/check-sonar-rules.mjs'));
  assert.ok(files.every((file) => file.endsWith('.mjs') && !file.endsWith('.spec.mjs')));
  assert.ok(!files.includes('packages/cli/src/catalog.generated.mjs'));
});
