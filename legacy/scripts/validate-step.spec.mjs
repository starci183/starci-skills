// One branch, three laws: scripts/validate-step.mjs#operatorValidator resolves every operator's own
// validator by its id, and validateStep dispatches it only when asked, so a validator that opens by
// calling validateStep for the shared laws never dispatches itself.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { operatorValidator } from './validate-step.mjs';
import { loadOperatorPackages } from './operator-md.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packages = (await loadOperatorPackages(root)).filter((p) => p.shape === 'v9');

test('every operator package exports exactly one step validator, and the resolver finds it by the package', async () => {
  assert.ok(packages.length >= 20);
  for (const pkg of packages) {
    const law = await operatorValidator(root, pkg);
    assert.equal(typeof law, 'function', `${pkg.manifest.id} has no validate<Name>Step export`);
    assert.match(law.name, /^validate[A-Za-z]*Step$/);
  }
});
test('a package with no validate.mjs, or none at all, resolves to nothing', async () => {
  assert.equal(await operatorValidator(root, { name: 'no-such-operator' }), null);
  assert.equal(await operatorValidator(root, null), null);
});
