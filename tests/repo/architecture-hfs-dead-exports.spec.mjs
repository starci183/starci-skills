import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';

// HFS check 4: an export of an owner's public entry that no production file outside the owner imports is dead
// (HFS_UNUSED_EXPORT). Specs are not part of the graph, so an export used only by a spec is dead on purpose.

const dead = (report, entry) => findings(report, 'HFS_UNUSED_EXPORT').filter(item => item.path === entry).map(item => item.name).sort();
const X = 'src/modules/domain/x/index.ts';

test('a dead export is flagged with its line and owner, a used export is not', t => {
  const root = archFixture(t, {
    files: {
      [X]: 'export const used = 1;\nexport const unused = 2;\nexport function alsoUnused() { return 3; }\n',
      'src/features/api/a/index.ts': "import { used } from '../../../modules/domain/x';\nexport const a = used;\n",
    },
  });
  const report = runArch(root);
  assert.deepEqual(dead(report, X), ['alsoUnused', 'unused']);
  const hit = findings(report, 'HFS_UNUSED_EXPORT').find(item => item.name === 'unused');
  assert.equal(hit.line, 2);
  assert.equal(hit.owner, 'src/modules/domain/x');
  assert.equal(report.coverage.hfsMachine.deadExports.status, 'checked');
  assert.ok(report.coverage.hfsMachine.deadExports.dead >= 2);
  assert.ok(report.coverage.checkedRuleIds.includes('HFS_UNUSED_EXPORT'));
});

test('an aliased import uses the exported name, and a same-owner import does not count', t => {
  const root = archFixture(t, {
    files: {
      [X]: "import { inner } from './inner';\nexport { inner as renamed };\nexport const local = 1;\n",
      'src/modules/domain/x/inner.ts': "import { local } from './index';\nexport const inner = local;\n",
      'src/features/api/a/index.ts': "import { renamed as r } from '../../../modules/domain/x';\nexport const a = r;\n",
    },
  });
  assert.deepEqual(dead(runArch(root), X), ['local']);
});

test('a namespace import uses every export', t => {
  const root = archFixture(t, {
    files: {
      [X]: 'export const one = 1;\nexport const two = 2;\n',
      'src/features/api/a/index.ts': "import * as x from '../../../modules/domain/x';\nexport const a = x;\n",
    },
  });
  assert.deepEqual(dead(runArch(root), X), []);
});

test('a dynamic import uses every export', t => {
  const root = archFixture(t, {
    files: {
      [X]: 'export const one = 1;\nexport const two = 2;\n',
      'src/features/api/a/index.ts': "export const a = () => import('../../../modules/domain/x');\n",
    },
  });
  assert.deepEqual(dead(runArch(root), X), []);
});

test('a type-only import uses the export', t => {
  const root = archFixture(t, {
    files: {
      [X]: 'export type Shape = { a: number };\nexport type Other = string;\n',
      'src/features/api/a/index.ts': "import type { Shape } from '../../../modules/domain/x';\nexport const a: Shape = { a: 1 };\n",
    },
  });
  assert.deepEqual(dead(runArch(root), X), ['Other']);
});

test('default export: used by a default import, otherwise dead', t => {
  const usedRoot = archFixture(t, {
    files: {
      [X]: 'export default 1;\n',
      'src/features/api/a/index.ts': "import one from '../../../modules/domain/x';\nexport const a = one;\n",
    },
  });
  assert.deepEqual(dead(runArch(usedRoot), X), []);
  const deadRoot = archFixture(t, {
    files: {
      [X]: 'export default 1;\nexport const named = 2;\n',
      'src/features/api/a/index.ts': "import { named } from '../../../modules/domain/x';\nexport const a = named;\n",
    },
  });
  assert.deepEqual(dead(runArch(deadRoot), X), ['default']);
});

test('a re-export by another owner counts only when the re-exported name is used', t => {
  const Y = 'src/modules/domain/y/index.ts';
  const root = archFixture(t, {
    files: {
      [X]: 'export const helper = 1;\nexport const other = 2;\n',
      [Y]: "export { helper } from '../x';\nexport { other } from '../x';\n",
      'src/features/api/a/index.ts': "import { helper } from '../../../modules/domain/y';\nexport const a = helper;\n",
    },
  });
  const report = runArch(root);
  assert.deepEqual(dead(report, X), ['other']);
  assert.deepEqual(dead(report, Y), ['other']);
});

test('a re-export nobody imports leaves the source export dead', t => {
  const root = archFixture(t, {
    files: {
      [X]: 'export const helper = 1;\n',
      'src/modules/domain/y/index.ts': "export { helper } from '../x';\n",
    },
  });
  const report = runArch(root);
  assert.deepEqual(dead(report, X), ['helper']);
  assert.deepEqual(dead(report, 'src/modules/domain/y/index.ts'), ['helper']);
});

test('an app owner is never checked', t => {
  const root = archFixture(t, {
    files: { 'apps/core/src/app.module.ts': 'export const AppModule = 1;\nexport const extra = 2;\n' },
  });
  const report = runArch(root);
  assert.deepEqual(findings(report, 'HFS_UNUSED_EXPORT').filter(item => item.path.startsWith('apps/')), []);
});

test('an export used only by a spec is dead', t => {
  const root = archFixture(t, {
    files: {
      [X]: 'export const onlySpec = 1;\n',
      'src/features/api/a/index.ts': 'export const a = 1;\n',
      'src/features/api/a/a.spec.ts': "import { onlySpec } from '../../../modules/domain/x';\nvoid onlySpec;\n",
    },
  });
  assert.deepEqual(dead(runArch(root), X), ['onlySpec']);
});

// Exception: a service unit spec and a fixture builder count as consumers (a spec can only provide a token the entry exports).
const CONSUMER_FILES = {
  [X]: 'export const TOKEN = 1;\nexport type Params = { a: number };\nexport const nobody = 2;\nexport const onlyE2e = 3;\n',
  'src/features/api/a/a.service.spec.ts': "import { TOKEN } from '../../../modules/domain/x';\nit('uses', () => { expect(TOKEN).toBe(1); });\n",
  'src/tests/fixtures/builders/x.builder.ts': "import type { Params } from '../../../modules/domain/x';\nexport const build = (): Params => ({ a: 1 });\n",
  'src/tests/e2e/x/x.e2e-spec.ts': "import { onlyE2e } from '../../../modules/domain/x';\nit('uses', () => { expect(onlyE2e).toBe(3); });\n",
};

test('HFS_UNUSED_EXPORT: an export used only by a service spec or a fixture builder passes; one used by nobody, or only by an e2e spec, still fails', t => {
  const report = runArch(archFixture(t, { files: CONSUMER_FILES }));
  assert.deepEqual(dead(report, X), ['nobody', 'onlyE2e']);
});

test('HFS_UNUSED_EXPORT: a spec of another kind does not count as a consumer', t => {
  const files = { ...CONSUMER_FILES, 'src/features/api/a/a.handler.spec.ts': "import { nobody } from '../../modules/domain/x';\nit('uses', () => { expect(nobody).toBe(2); });\n" };
  assert.deepEqual(dead(runArch(archFixture(t, { files })), X), ['nobody', 'onlyE2e']);
});
