// proves: RT_EXAMPLE_COUPLING@lite
// proves: RT_EXAMPLE_COUPLING@full
// proves: RT_PRODUCT_NAME_IN_SOURCE@lite
// proves: RT_PRODUCT_NAME_IN_SOURCE@full
// proves: RT_HOST_PATH_IN_TEMPLATE@lite
// proves: RT_HOST_PATH_IN_TEMPLATE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkExampleCoupling } from '../../scripts/checks/check-example-coupling.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const fixture = (t, edition, files) => {
  const root = mkdtemp(t, `starci-example-coupling-proof-${edition}-`);
  fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify({ hfs: 1, kind: 'runtime', edition }));
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  return root;
};

for (const edition of ['lite', 'full']) {
  test(`${edition}: a literal example directory in runtime source is refused`, (t) => {
    const root = fixture(t, edition, { 'scripts/read.mjs': 'export const root = "examples/acme-app";\n' });
    assert.deepEqual(checkExampleCoupling(root).hits.map((hit) => hit.code), ['RT_EXAMPLE_COUPLING']);
  });

  test(`${edition}: a shipped product name in runtime source is refused`, (t) => {
    const root = fixture(t, edition, { 'engine/label.mjs': 'export const label = "nivo";\n' });
    assert.deepEqual(checkExampleCoupling(root).hits.map((hit) => hit.code), ['RT_PRODUCT_NAME_IN_SOURCE']);
  });

  test(`${edition}: a host drive path in a managed template is refused`, (t) => {
    const drive = ['C', ':/work/checkout'].join('');
    const root = fixture(t, edition, { 'packages/hfs/templates/app/config.yaml': `root: ${drive}\n` });
    assert.deepEqual(checkExampleCoupling(root).hits.map((hit) => hit.code), ['RT_HOST_PATH_IN_TEMPLATE']);
  });

  test(`${edition}: relative paths and a declared shared reference pass without any coupling code`, (t) => {
    const root = fixture(t, edition, {
      'scripts/read.mjs': 'import { APP } from "./lib/example-refs.mjs";\nexport const root = APP;\n',
      'scripts/lib/example-refs.mjs': 'export const APP = "examples/acme-app";\n',
      'engine/label.mjs': 'export const label = "application";\n',
      'packages/hfs/templates/app/config.yaml': 'root: ./src\n',
    });
    const report = checkExampleCoupling(root);
    assert.equal(report.filesScanned, 3);
    assert.deepEqual(report.hits.map((hit) => hit.code), []);
  });
}
