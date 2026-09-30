import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-be-fixture.mjs';

// R30 index-export-count (BE_PUBLIC_SURFACE): an owner has exactly one index.ts, holding only named `export { }` and
// `export type { }` lines, at most the slot's indexExports budget of names.
const E = 'export const value = 1;\n';
const names = count => Array.from({ length: count }, (_, index) => `n${index}`);
const wide = count => `${names(count).map(name => `export const ${name} = 1;`).join('\n')}\n`;
const reexport = count => `export { ${names(count).join(', ')} } from './wide';\n`;
const hits = report => findings(report, 'BE_PUBLIC_SURFACE');
const run = (t, files) => runArch(archFixture(t, { files }));

test('owners whose index.ts is only named export lines within the budget raise no BE_PUBLIC_SURFACE', t => {
  const report = run(t, {
    'src/modules/domain/x/index.ts': "export { XService } from './x.service';\nexport type { XView } from './x.contracts';\n",
    'src/modules/domain/x/x.service.ts': 'export class XService {}\n',
    'src/modules/domain/x/x.contracts.ts': 'export interface XView { id: string }\n',
    'src/features/a/index.ts': "export { AModule } from './a.module';\n",
    'src/features/a/a.module.ts': 'export class AModule {}\n',
  });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.publicSurface.status, 'checked');
  assert.equal(report.coverage.hfsMachine.publicSurface.entries, 2);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_PUBLIC_SURFACE'));
});

test('an index over the indexExports budget is BE_PUBLIC_SURFACE, at the budget it is not', t => {
  const over = hits(run(t, { 'src/modules/domain/x/index.ts': reexport(61), 'src/modules/domain/x/wide.ts': wide(61) }));
  assert.equal(over.length, 1);
  assert.equal(over[0].exports, 61);
  assert.equal(over[0].budget, 60);
  const exact = hits(run(t, { 'src/modules/domain/x/index.ts': reexport(60), 'src/modules/domain/x/wide.ts': wide(60) }));
  assert.deepEqual(exact, []);
});

test('the budget also binds platform and integrations owners', t => {
  const report = run(t, {
    'src/modules/platform/logging/index.ts': reexport(61),
    'src/modules/platform/logging/wide.ts': wide(61),
    'src/modules/integrations/payos/index.ts': reexport(61),
    'src/modules/integrations/payos/wide.ts': wide(61),
  });
  assert.deepEqual(hits(report).map(item => item.path).sort(), ['src/modules/integrations/payos/index.ts', 'src/modules/platform/logging/index.ts']);
});

test('an index holding an import, a declaration or a default export is BE_PUBLIC_SURFACE per statement', t => {
  const report = run(t, {
    'src/modules/domain/x/index.ts': "import { XService } from './x.service';\nexport const xEntities = [XService];\nexport default XService;\nexport { XService };\n",
    'src/modules/domain/x/x.service.ts': 'export class XService {}\n',
  });
  assert.equal(hits(report).length, 3, JSON.stringify(hits(report), null, 1));
  assert.ok(hits(report).every(item => item.path === 'src/modules/domain/x/index.ts'));
});

test('a nested index.ts under an owner root is BE_PUBLIC_SURFACE, in a feature and in a capability', t => {
  const report = run(t, {
    'src/modules/domain/x/index.ts': "export { XService } from './x.service';\n",
    'src/modules/domain/x/x.service.ts': 'export class XService {}\n',
    'src/modules/domain/x/persistence/index.ts': E,
    'src/modules/domain/x/errors/index.ts': E,
    'src/features/a/index.ts': "export { value } from './value';\n",
    'src/features/a/value.ts': E,
    'src/features/a/application/index.ts': E,
  });
  assert.deepEqual(hits(report).map(item => item.path).sort(), ['src/features/a/application/index.ts', 'src/modules/domain/x/errors/index.ts', 'src/modules/domain/x/persistence/index.ts']);
});
