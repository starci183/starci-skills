import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';

// R156 BE_KIND_ISOLATION: a feature whose owner slot names one trigger kind never imports a feature of another kind. The kinds are
// read from the slot field `trigger` of the owner (api = be.feature, jobs = be.feature.jobs, reactors = be.feature.reactors), never from
// a folder name; the same-kind and no-kind cases keep the older code BE_FEATURE_IMPORTS_FEATURE.

const PATTERNS = { patterns: ['event-bus', 'fenced-job'] };
const kind = report => findings(report, 'BE_KIND_ISOLATION');
const featureImports = report => findings(report, 'BE_FEATURE_IMPORTS_FEATURE');

test('BE_KIND_ISOLATION: a jobs feature importing a reactors feature, and an api feature importing a jobs feature, are each refused with the event bus as the fix', t => {
  const root = archFixture(t, {
    declaration: PATTERNS,
    files: {
      'src/features/jobs/send/index.ts': "import { stock } from '../../reactors/stock';\nexport const send = stock;\n",
      'src/features/reactors/stock/index.ts': 'export const stock = 1;\n',
      'src/features/orders/index.ts': "import type { Send } from '../jobs/send';\nexport type Order = Send;\n",
    },
  });
  const report = runArch(root);
  const hits = kind(report);
  assert.equal(hits.length, 2, JSON.stringify(hits));
  const byPath = Object.fromEntries(hits.map(item => [item.path, item]));
  assert.match(byPath['src/features/jobs/send/index.ts'].message, /a jobs feature imports a reactors feature/);
  assert.match(byPath['src/features/jobs/send/index.ts'].message, /eventBus\.publish\(event, tx\)/);
  assert.equal(byPath['src/features/orders/index.ts'].typeOnly, true);
  assert.deepEqual(featureImports(report), [], 'a cross-kind import is the kind finding, not a second one');
  assert.ok(report.coverage.checkedRuleIds.includes('BE_KIND_ISOLATION'));
});

test('BE_KIND_ISOLATION: a sub-folder file of a kind is judged by its owner, so a step reaching another kind is refused', t => {
  const root = archFixture(t, {
    declaration: PATTERNS,
    files: {
      'src/features/jobs/send/index.ts': 'export const send = 1;\n',
      'src/features/jobs/send/steps/mail.step.ts': "import { stock } from '../../../reactors/stock';\nexport const step = stock;\n",
      'src/features/reactors/stock/index.ts': 'export const stock = 1;\n',
    },
  });
  const hits = kind(runArch(root));
  assert.deepEqual(hits.map(item => item.path), ['src/features/jobs/send/steps/mail.step.ts']);
});

test('BE_KIND_ISOLATION: imports inside one owner, down into modules, and between features of the same kind are not kind findings', t => {
  const root = archFixture(t, {
    declaration: PATTERNS,
    files: {
      'src/features/jobs/send/index.ts': "import { inner } from './steps/mail.step';\nimport { x } from '../../../modules/domain/x';\nimport { p } from '../../../modules/platform/config';\nexport const send = [inner, x, p];\n",
      'src/features/jobs/send/steps/mail.step.ts': 'export const inner = 1;\n',
      'src/features/jobs/other/index.ts': "import { send } from '../send';\nexport const other = send;\n",
      'src/modules/domain/x/index.ts': 'export const x = 1;\n',
      'src/modules/platform/config/index.ts': 'export const p = 1;\n',
    },
  });
  const report = runArch(root);
  assert.deepEqual(kind(report), []);
  const same = featureImports(report);
  assert.equal(same.length, 1, 'two jobs features still never import each other (R28)');
  assert.equal(same[0].path, 'src/features/jobs/other/index.ts');
});
