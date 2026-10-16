// proves: BE_KIND_ISOLATION@lite
// proves: BE_KIND_ISOLATION@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { byCodeUnit } from '../../scripts/lib/list.mjs';
import { appDeclaration, archFixture, findings, runArch } from '../helpers/hfs-arch-fixture.mjs';
import { projectFixture } from '../../packages/eslint/be/fixtures/project/tester.mjs';
import { rules } from '../../packages/eslint/be/project-graph.mjs';

const declaration = { apps: [{ name: 'core', kind: 'api' }], patterns: ['event-bus', 'fenced-job'] };
const passingFiles = {
  'src/features/jobs/clean/index.ts': "import { inner } from './steps/mail.step';\nimport { value } from '../../../modules/domain/shared';\nexport const clean = [inner, value];\n",
  'src/features/jobs/clean/steps/mail.step.ts': 'export const inner = 1;\n',
  'src/features/reactors/stock/index.ts': 'export const stock = 1;\nexport type Stock = number;\n',
  'src/modules/domain/shared/index.ts': 'export const value = 1;\n',
};
const violatingFiles = {
  'src/features/jobs/static/index.ts': "import { stock } from '../../reactors/stock';\nexport const send = stock;\n",
  'src/features/jobs/dynamic/index.ts': "export const send = () => import('../../reactors/stock');\n",
  'src/features/jobs/exporting/index.ts': "export { stock } from '../../reactors/stock';\n",
  'src/features/jobs/typed/index.ts': "import type { Stock } from '../../reactors/stock';\nexport type Send = Stock;\n",
};

function machineFixture(t, edition, files) {
  return archFixture(t, {
    declaration,
    files: {
      ...files,
      '../hfs.json': JSON.stringify({ ...appDeclaration('be', declaration), edition }),
    },
  });
}

for (const edition of ['lite', 'full']) {
  test(`${edition} kind isolation rejects static, dynamic, re-export and type-only cross-kind imports`, t => {
    const root = machineFixture(t, edition, { ...passingFiles, ...violatingFiles });
    const hits = findings(runArch(root), 'BE_KIND_ISOLATION');
    assert.equal(hits.length, 4);
    assert.deepEqual(hits.map(hit => hit.path).sort(byCodeUnit), Object.keys(violatingFiles).sort(byCodeUnit));
    assert.equal(hits.find(hit => hit.path.includes('/typed/')).typeOnly, true);
  });

  test(`${edition} kind isolation accepts imports within one owner and down into modules`, t => {
    const root = machineFixture(t, edition, passingFiles);
    assert.deepEqual(findings(runArch(root), 'BE_KIND_ISOLATION'), []);
  });

  test(`${edition} kind isolation lint accepts valid owners and rejects cross-kind imports`, t => {
    const files = { ...passingFiles, ...violatingFiles };
    const fixture = projectFixture({ edition, declaration, files });
    t.after(fixture.cleanup);
    fixture.tester.run('kind-isolation', rules['kind-isolation'], {
      valid: [
        { filename: fixture.at('src/features/jobs/clean/index.ts'), code: passingFiles['src/features/jobs/clean/index.ts'] },
        { filename: fixture.at('src/features/reactors/stock/index.ts'), code: passingFiles['src/features/reactors/stock/index.ts'] },
      ],
      invalid: [
        { filename: fixture.at('src/features/jobs/static/index.ts'), code: violatingFiles['src/features/jobs/static/index.ts'], errors: [{ message: /BE_KIND_ISOLATION/, line: 1 }] },
        { filename: fixture.at('src/features/jobs/dynamic/index.ts'), code: violatingFiles['src/features/jobs/dynamic/index.ts'], errors: [{ message: /BE_KIND_ISOLATION/, line: 1 }] },
        { filename: fixture.at('src/features/jobs/exporting/index.ts'), code: violatingFiles['src/features/jobs/exporting/index.ts'], errors: [{ message: /BE_KIND_ISOLATION/, line: 1 }] },
        { filename: fixture.at('src/features/jobs/typed/index.ts'), code: violatingFiles['src/features/jobs/typed/index.ts'], errors: [{ message: /BE_KIND_ISOLATION/, line: 1 }] },
      ],
    });
  });
}
