// lint-scope.spec.mjs - the lint scope `starci app lint` reads from the installed canon's flat config (canonScope): global ignores prune
// the walk, and a block's own `ignores` narrow only that block (the canons' Sonar-way block), as flat config defines them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonScope } from '../lint/run.mjs';

test('a block with its own ignores narrows only that block; another block still selects the file', () => {
  const scope = canonScope([
    { ignores: ['**/dist/**'] },
    { files: ['**/*.ts'], rules: {} },
    { files: ['**/*.ts'], ignores: ['**/*.spec.ts'], plugins: {}, rules: {} },
  ]);
  assert.equal(scope.source('src/a.service.ts'), true);
  assert.equal(scope.source('src/a.service.spec.ts'), true, 'the first block still selects a spec');
  assert.equal(scope.ignored('dist/a.js'), true);
  assert.equal(scope.ignored('src/a.service.ts'), false);
});

test('a file only a narrowed block selects is outside the scope when that block ignores it', () => {
  const scope = canonScope([{ files: ['**/*.ts'], ignores: ['**/*.spec.ts'], rules: {} }]);
  assert.equal(scope.source('src/a.service.ts'), true);
  assert.equal(scope.source('src/a.service.spec.ts'), false);
  assert.equal(scope.ignored('src/a.service.spec.ts'), false, 'a block ignore never prunes the walk');
});

test('negated, non-string or missing selectors cannot prove a scope', () => {
  assert.throws(() => canonScope([{ files: ['!**/*.ts'] }]), /unsupported canon files selectors/);
  assert.throws(() => canonScope([{ files: ['**/*.ts'], ignores: [1] }]), /unsupported canon ignores selectors/);
  assert.throws(() => canonScope([{ ignores: ['**/dist/**'] }]), /no source selectors/);
  assert.throws(() => canonScope([null]), /invalid config block/);
});
