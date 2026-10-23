// proves: BE_FEATURE_SHAPE@lite
// proves: BE_FEATURE_SHAPE@full
// proves: BE_FEATURE_LAYOUT_INVALID@lite
// proves: BE_FEATURE_LAYOUT_INVALID@full
// proves: BE_APPLICATION_IMPORTS_TRANSPORT@lite
// proves: BE_APPLICATION_IMPORTS_TRANSPORT@full
// proves: BE_APPLICATION_TRANSPORT_FRAMEWORK@lite
// proves: BE_APPLICATION_TRANSPORT_FRAMEWORK@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { projectFixture } from '../../eslint/be/fixtures/project/tester.mjs';
import { rules } from '../../eslint/be/project-graph.mjs';
import { checkFeatureShape } from '../runtime/scripts/hfs/architecture/feature-shape.mjs';
import { openHfs } from '../runtime/scripts/hfs/slots.mjs';

const FEATURE = 'src/features/api/orders';
const VALUE = 'export const value = 1;\n';
const runtimeRoot = fileURLToPath(new URL('../runtime/', import.meta.url));
const shape = f => checkFeatureShape({
  config: { root: f.root }, graph: { resolver: openHfs({ root: runtimeRoot, repoRoot: f.root }) },
});

function fixture(t, edition, files) {
  const result = projectFixture({ edition, files });
  t.after(result.cleanup);
  return result;
}

const passing = (f, files, rel) => ({ filename: f.at(rel), code: files[rel] });
const violating = (f, files, rel, code) => ({
  ...passing(f, files, rel), errors: [{ message: new RegExp(code), line: 1 }],
});

for (const edition of ['lite', 'full']) {
  test(`passing ${edition} feature files occupy their allowed slots`, t => {
    const files = {
      [`${FEATURE}/index.ts`]: VALUE,
      [`${FEATURE}/orders.module.ts`]: VALUE,
      [`${FEATURE}/application/run.command.ts`]: VALUE,
      [`${FEATURE}/application/run.handler.ts`]: VALUE,
      [`${FEATURE}/transport/http/orders-http.module.ts`]: VALUE,
      [`${FEATURE}/transport/http/orders.controller.ts`]: VALUE,
    };
    const f = fixture(t, edition, files);
    assert.deepEqual(shape(f).violations.filter(item => item.ruleId === 'BE_FEATURE_SHAPE'), []);
  });

  test(`violating ${edition} feature root refuses an unowned file`, t => {
    const f = fixture(t, edition, {
      [`${FEATURE}/index.ts`]: VALUE,
      [`${FEATURE}/helper.ts`]: VALUE,
    });
    assert.deepEqual(shape(f).violations.filter(item => item.ruleId === 'BE_FEATURE_SHAPE').map(item => item.ruleId), ['BE_FEATURE_SHAPE']);
  });

  test(`passing and violating ${edition} feature roles stay in their folders`, t => {
    const good = `${FEATURE}/transport/http/orders.controller.ts`;
    const bad = `${FEATURE}/orders.controller.ts`;
    const files = { [`${FEATURE}/index.ts`]: VALUE, [good]: VALUE, [bad]: VALUE };
    const f = fixture(t, edition, files);
    f.tester.run('feature-layout', rules['feature-layout'], {
      valid: [passing(f, files, good)],
      invalid: [violating(f, files, bad, 'BE_FEATURE_LAYOUT_INVALID')],
    });
  });

  test(`passing and violating ${edition} application code is independent of transport`, t => {
    const good = `${FEATURE}/application/run.handler.ts`;
    const adapter = `${FEATURE}/application/adapter.handler.ts`;
    const framework = `${FEATURE}/application/framework.handler.ts`;
    const files = {
      [`${FEATURE}/index.ts`]: VALUE,
      [good]: VALUE,
      [adapter]: "import { controller } from '../transport/http/orders.controller';\nexport const handler = controller;\n",
      [framework]: "import { Resolver } from '@nestjs/graphql';\nexport const handler = Resolver;\n",
      [`${FEATURE}/transport/http/orders.controller.ts`]: 'export const controller = 1;\n',
    };
    const f = fixture(t, edition, files);
    f.tester.run('application-never-imports-transport', rules['application-never-imports-transport'], {
      valid: [passing(f, files, good)],
      invalid: [
        violating(f, files, adapter, 'BE_APPLICATION_IMPORTS_TRANSPORT'),
        violating(f, files, framework, 'BE_APPLICATION_TRANSPORT_FRAMEWORK'),
      ],
    });
  });

}
